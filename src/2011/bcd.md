# Fast Binary-Coded Decimal Addition and Subtraction

<div class="infobar">

*fa-clock-o* *time-2011-04-05*
*fa-user* Tavian Barnes

</div>


[Binary-Coded Decimal], or BCD, is the most obvious way to encode a positionally-represented decimal number in binary: literally, 1234 becomes 0x1234.
The some of the earliest of early computers used this representation, and the SMS protocol still uses it for some ungodly reason.
It also has a more sane role as the expanded version of the [DPD] encoding for [IEEE 754-2008] decimal numbers.

[Binary-Coded Decimal]: http://en.wikipedia.org/wiki/Binary-coded_decimal
[DPD]: http://en.wikipedia.org/wiki/Densely_packed_decimal
[IEEE 754-2008]: http://en.wikipedia.org/wiki/IEEE_754-2008

Working with BCD is unwieldy and slow, but at least for addition and subtraction there is a neat bit-trick that helps a lot.
The carry-free case can be accomplished with a regular binary addition (0x1234 + 0x1234 = 0x2468), but to handle the case with carries, we need to force hex carries where there would have been decimal carries (since 0x1234 + 0x5678 = 0x68AC, which is no good).

The trick is to add 0x6666... to the hex sum, because 9 + 6 = 0xF, the highest value of a single hexit.
So we've got 0x1234 + 0x5678 + 0x6666 = 0xCF12, which has the last two "digits" correct.
However, now the digits without carries are wrong, but we can detect those bits with ~((0xCF12 ^ 0x1234 ^ 0x5678) & 0x11110), and use that to subtract the 6s where appropriate.
The full calculation looks like this:

```c
sum = a + b + 0x6666...;
noncarries = ~(sum ^ a ^ b) & 0x11111...;
sum -= (noncarries >> 2) | (noncarries >> 3);
```

For similar reasons, subtraction can be accomplished this way:

```c
diff = a - b;
borrows = (diff ^ a ^ b) & 0x11111...;
diff -= (borrows >> 2) | (borrows >> 3);
```

My implementation of this trick (in x86-64 assembly), can be seen [here].

[here]: https://github.com/tavianator/fpfd/blob/039d98f7ab3a2eef7f390641bf700a6092eef853/libfpfd-dpd/x86_64/addsub-x86_64.s#L110
