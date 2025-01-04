# The Alder Lake anomaly, explained

<div class="infobar">

*fa-clock-o* *time-2025-01-04*
*fa-user* Tavian Barnes

</div>

A couple days ago, I [posted](shlx.md) about an anomaly in the latency of the `SHLX` instruction on Alder Lake performance cores.
[Pete Cawley](https://x.com/corsix/status/1874965887108976858) and others on [Twitter](https://x.com/tavianator/status/1874942972439265752) and [Hacker News](https://news.ycombinator.com/item?id=42579969) pointed me in the right direction and I now have a better understanding of when the anomaly happens and what causes it.
Not a complete understanding of why it exists in the first place, but until I get an electron microscope this might be the most I can hope for :)

The anomaly is related to [register renaming](https://en.wikipedia.org/wiki/Register_renaming), an optimization performed by CPUs that maps a limited set of architectural registers (`rax`, `rbx`, ...) to a larger set of physical registers.
The CPU uses something like [Tomasulo's algorithm](https://en.wikipedia.org/wiki/Tomasulo%27s_algorithm) to convert machine code like this:

```x86asm
        mov  rax, rdi ; rax = rdi
        add  rax, 1   ; rax = rax + 1
        imul rax, rdi ; rax = rax * rdi
        shr  rax      ; rax = rax >> 1
```

into micro-operations that look more like this:

```x86asm
                           ; (initially)      (rdi -> pr1)
                           ; (rename)         (rax -> pr1)
        add  pr2, pr1, 1   ; pr2 = pr1 + 1    (rax -> pr2)
        imul pr3, pr2, pr1 ; pr3 = pr2 * pr1  (rax -> pr3)
        shr  pr4, pr3      ; pr4 = pr3 >> 1   (rax -> pr4)
```

Renaming has eliminated the `mov rax, rdi` instruction by pointing both `rax` and `rdi` to the same *physical* register, `pr1`.
In a sense, `mov` is "free": it has zero latency since no µop is even issued for it.

In 2021, Andreas Abel (creator of [uops.info](https://uops.info)) [noticed](https://x.com/uops_info/status/1473807584490672130) that the Alder Lake renamer is even more powerful than this.
It can also eliminate the `add rax, 1` instruction!
You can observe this my measuring the throughput of repeated `add`s:

```x86asm
        add rax, 1
        add rax, 1
        add rax, 1
        ...
```

Normally this would execute at 1 instruction per cycle, since each `add` needs to wait 1 cycle for the previous `add` to complete.
But on Alder Lake P-cores, this runs at 5 instructions per cycle!
It appears that the renamer doesn't just support simple mappings like `rax -> pr1`, but also more complicated ones like `rax -> (pr1 + 1)`.
The instruction stream gets translated to something like

```x86asm
        ; initially (rax -> pr1)
        ; rename    (rax -> pr1 + 1)
        ; rename    (rax -> pr1 + 2)
        ; rename    (rax -> pr1 + 3)
        ...
```

Almost no µops are actually being issued, so this basically runs as fast as the frontend can decode and rename instructions.
The offsets seem to be limited to 11 bits, restricting them to the range [-1024, 1023].
That means that every once in a while, the offset overflows and the renamer has to give up and actually issue an `add` µop.
If you make the immediate larger, this will happen more often, and you can observe reduced throughput.
For example, repeated `add rax, 256` is handled like this:

```x86asm
        ; initially (rax -> pr1)
        ; rename    (rax -> pr1 + 256)
        ; rename    (rax -> pr1 + 512)
        ; rename    (rax -> pr1 + 768)
        add pr2, (pr1 + 768), 256      ; renaming would overflow
        ; rename    (rax -> pr2 + 256)
        ; rename    (rax -> pr2 + 512)
        ; rename    (rax -> pr2 + 768)
        add pr3, (pr2 + 768), 256
        ...
```

This runs at only 2.5 instructions per cycle, because not all the `add`s are eliminated.
It's not just `add` that gets optimized like this; all of these are supported:

```x86asm
        mov rax, imm11         ; rax -> (pr0* +  imm11)  (*the zero register)
        add rax, imm11         ; rax -> (prax +  imm11)
        sub rax, imm11         ; rax -> (prax + -imm11)
        inc rax                ; rax -> (prax +  1)
        dec rax                ; rax -> (prax + -1)
        lea rax, [rbx + imm11] ; rax -> (prbx +  imm11)
```

Only 64-bit operand sizes are supported, so `mov eax, 1` doesn't trigger it despite having the same semantics as `mov rax, 1`.

Something remarkable about this optimization is that every µop needs to be able to handle operands like `(pr2 + 768)` rather than just registers like `pr2`.
Almost all of them seem to do this with no performance penalty.
(I suspect the value of operands like `(pr2 + 768)` is computed somewhere between reading the physical register file and writing to the execution port.)
That is, every µop *except shifts*.

For some reason, if the shift count register for any dynamic shift is renamed to one of these special `(prX + Y)` operands, the µop will take 3 cycles instead of 1.
**This includes all the normal shift instructions ([`shl`/`shr`/`sar`](https://www.felixcloutier.com/x86/sal:sar:shl:shr)) and rotate instructions ([`rol`/`ror`/`rcl`/`rcr`](https://www.felixcloutier.com/x86/rcl:rcr:rol:ror))**, as well as the BMI2 ones ([`shlx`/`shrx`/`sarx`](https://www.felixcloutier.com/x86/sarx:shlx:shrx)).
We just noticed the BMI2 ones first because [uops.info](https://uops.info/html-instr/SHLX_R64_R64_R64.html#ADL-P) happened to trigger this anomaly when measuring them.

For the normal shift instructions, only the shift count is affected, meaning this is slow:

```x86asm
        mov rax, 1  ; rax -> (pr0 + 1)
        mov rcx, 1  ; rcx -> (pr0 + 1)
        shl rax, cl ; 3 cycles
```

but this is fast:

```x86asm
        mov rax, 1  ; rax -> (pr0 + 1)
        mov ecx, 1
        shl rax, cl ; 1 cycle
```

For the BMI2 shifts, **both operands** are affected!

```x86asm
        mov  rbx, 1        ; rbx -> (p0 + 1)
        mov  ecx, 1
        shlx rax, rbx, rcx ; 3 cycles

        mov  ebx, 1
        mov  rcx, 1        ; rcx -> (p0 + 1)
        shlx rax, rbx, rcx ; 3 cycles

        mov ebx, 1
        mov ecx, 1
        shlx rax, rbx, rcx ; 1 cycle
```

As for why this happens, your guess is as good as mine.
It's possible that [dynamic shifts are already so expensive that the extra addition pushes them over 1 cycle](https://x.com/corsix/status/1875334564320874945).
It's possible that [a bug in the hardware forced these shifts to become more expensive as a workaround](https://news.ycombinator.com/item?id=42582174).
Or maybe Intel was running out of transistors after supporting every other opcode and decided shifts weren't important enough.
I have no idea, but if anyone does I'd love to hear about it.
