# The Alder Lake `SHLX` anomaly

<div class="infobar">

*fa-clock-o* *time-2025-01-02*
*fa-user* Tavian Barnes

</div>

At the end of 2024, Harold Aptroot posted this:

> Apparently shlx is a "medium latency" (3 cycles) instruction on Alder Lake. My disappointment is immeasurable, and my day is ruined.
>
> &mdash; [Twitter](https://x.com/HaroldAptroot/status/1873461353203302819) / [Bluesky](https://bsky.app/profile/haroldaptroot.bsky.social/post/3leht4lp2dk2u) / [Mastodon](https://mastodon.gamedev.place/@harold/113737900853968212)

I was immediately [nerd sniped](https://xkcd.com/356/) because I am into low-level performance analysis, and I happen to own an Alder Lake laptop.

A bit of background: [*Alder Lake*](https://en.wikipedia.org/wiki/Alder_Lake) is the 12th generation of Intel Core processors.
It's the first generation with a "hybrid architecture," containing both performance (P) and efficiency (E) cores.
[`SHLX`](https://www.felixcloutier.com/x86/sarx:shlx:shrx) is a left-shift instruction introduced in the [BMI2](https://en.wikipedia.org/wiki/X86_Bit_manipulation_instruction_set#BMI2_(Bit_Manipulation_Instruction_Set_2)) instruction set.
The main difference with [`SHL`](https://www.felixcloutier.com/x86/sal:sar:shl:shr) is that `SHLX` doesn't affect the [FLAGS](https://en.wikipedia.org/wiki/FLAGS_register) register.
It's also a 3-operand instruction:

```x86asm
        SHL  RAX, CL       ; RAX = RAX << CL
                           ; (only CL allowed as shift count)

        SHLX RAX, RBX, RDX ; RAX = RBX << RDX
                           ; (any register allowed as shift count)
```

Left-shift is one of the simplest things to implement in hardware, so it's quite surprising that it should take 3 whole CPU cycles.
It's been 1 cycle on every other CPU I'm aware of.
It's even 1 cycle on Alder Lake's *efficiency cores*!
Only the performance cores have this particular performance problem.

The 3-cycle figure Harold cited comes from [uops.info](https://uops.info/html-instr/SHLX_R64_R64_R64.html#ADL-P).
They even document the exact [instruction sequence](https://uops.info/html-lat/ADL-P/SHLX_R64_R64_R64-Measurements.html#lat2-%3E1) used in their benchmark that measured the 3-cycle latency, with a sample [nanoBench](https://github.com/andreas-abel/nanoBench) command to reproduce it.
Running that command on my laptop indeed measures 3 cycles of latency.

On the other hand, other sources (like [Intel](https://www.intel.com/content/www/us/en/content-details/671488/intel-64-and-ia-32-architectures-optimization-reference-manual-volume-1.html) and [InstLatX64](http://users.atw.hu/instlatx64/GenuineIntel/GenuineIntel00906A4_AlderLakeP_00_BC_InstLatX64.txt)) claim the latency is 1 cycle.
What gives?
I decided to write my own benchmark to try to understand the discrepancy.

```x86asm
.intel_syntax noprefix
.globl main
main:
        MOV RDX, 10000     ; RDX = 10000
        XOR RAX, RAX       ; RAX = 0
.LOOP:
        MOV RCX, 1         ; RCX = 1
.rept 10000
        SHLX RAX, RAX, RCX ; RAX = RAX << RCX
                           ; (repeated 10,000 times)
.endr
        DEC RDX
        JNZ .LOOP          ; (loop 10,000 times)
        XOR EAX, EAX
        RET                ; return 0
```

This code contains an outer loop with 10,000 iterations.
Inside the loop, we initialize `RCX` to 1, then run `SHLX RAX, RAX, RCX` 10,000 times.
In total, we run `SHLX` 10,000,000 times, so all the other instructions (including the ones before `main()` runs) are negligible.
I used `taskset -c 0` to pin it to a P core, and `perf` for measurement:

```console
$ gcc shlx.s -o shlx
$ taskset -c 0 perf stat --cputype=core -e 'cycles,instructions' ./shlx

 Performance counter stats for './shlx':

       301,614,809      cpu_core/cycles:u/
       100,155,910      cpu_core/instructions:u/         #    0.33  insn per cycle
```

Here we see 0.33 instructions per cycle, a.k.a. 3-cycle latency.

Let's try initializing `RCX` differently:

```diff
 .LOOP:
-        MOV RCX, 1
+        MOV ECX, 1
```

`ECX` is the 32-bit low half of the 64-bit `RCX` register.
On x86-64, writing a 32-bit register implicitly sets the upper half of the corresponding 64-bit register to zero.
So these two instructions should behave identically.
And yet:

```
 Performance counter stats for './shlx':

       100,321,870      cpu_core/cycles:u/
       100,155,867      cpu_core/instructions:u/         #    1.00  insn per cycle
```

It seems like `SHLX` performs differently depending on how the shift count register is initialized.
If you use a 64-bit instruction with an immediate, performance is slow.
This is also true for instructions like `INC` (which is similar to `ADD` with a 1 immediate).

```diff
 .LOOP:
-        MOV RCX, 1
+        XOR RCX, RCX
+        INC RCX
```

```
 Performance counter stats for './shlx':

       300,138,108      cpu_core/cycles:u/
       100,165,881      cpu_core/instructions:u/         #    0.33  insn per cycle
```

On the other hand, 32-bit instructions, and 64-bit instructions without immediates (even no-op ones), make it fast.
All of these ways to initialize RCX lead to 1-cycle latency:

```x86asm
.LOOP:
        MOV ECX, 1
```

```x86asm
.LOOP:
        XOR RCX, RCX
```

```x86asm
.LOOP:
        MOV RCX, 1
        MOV RCX, RCX
```

```x86asm
        MOV RCX, 1
.LOOP:
        PUSH RCX
        POP RCX
```

It is very strange to me that the *instruction used to set the shift count register* can make the `SHLX` instruction 3&times; slower.
The 32-bit vs. 64-bit operand size distinction is especially surprising to me as `SHLX` only looks at the bottom 6 bits of the shift count.

I do not have a good explanation for this yet, but I will update this page if I ever figure it out.
