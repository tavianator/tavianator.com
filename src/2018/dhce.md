# Cracking DHCE (Diffie-Hellman color exchange)

<div class="infobar">

*fa-clock-o* *time-2018-09-21*
*fa-user* Tavian Barnes
[*fa-reddit* Reddit](https://www.reddit.com/r/programming/comments/7r1vc2/cracking_dhce_diffiehellman_color_exchange/)

</div>


I recently saw a [video] that explains [Diffie–Hellman key exchange] in terms of mixing colors of paint.
It's a wonderfully simple and informative analogy, that Wikipedia actually uses [as well].
If you don't know about Diffie-Hellman, definitely watch the video and/or read the Wikipedia page to get a handle on it—it's not that complicated once you get the "trick." The color analogy intrigued me because I know just enough about both cryptography and color theory to be dangerous.
So in this post, I'm going to attack the security of the color exchange protocol.
("Real" Diffie-Hellman remains secure, as far as I know.)

[video]: https://youtu.be/YEBfamv-_do
[Diffie–Hellman key exchange]: https://en.wikipedia.org/wiki/Diffie%E2%80%93Hellman_key_exchange
[as well]: https://en.wikipedia.org/wiki/Diffie%E2%80%93Hellman_key_exchange#/media/File:Diffie-Hellman_Key_Exchange-modified.png

To summarize and somewhat formalize the "DHCE" protocol, suppose we have a `$\mathrm{mix}(x, y, r)$` function that mixes the colors `$x$` and `$y$` in an `$r : (1 - r)$` ratio. Starting with a shared, public color `$S$`, Alice and Bob do the following:

| Alice                                    | Bob                                      |
| ---------------------------------------- | ---------------------------------------- |
| Picks a secret color `$a$`               | Picks as secret color `$b$`              |
| Sends `$A = \mathrm{mix}(S, a, 1/2)$`    | Sends `$B = \mathrm{mix}(S, b, 1/2)$`    |
| Computes `$k = \mathrm{mix}(a, B, 1/3)$` | Computes `$k = \mathrm{mix}(b, A, 1/3)$` |

In the end, they end up with the same secret color `$k$` because paint mixing is associative and commutative, i.e. it doesn't matter what order you mix the paints in.
The `$1/3$` ratio in the final mixing step is because `$A$` and `$B$` contain twice as much paint as `$a$` and `$b$`, and we want the final mixture to contain equal parts of `$a$`, `$b$`, and `$S$`.

But how secret is `$k$`, really?
In order for it to be secret, our eavesdropper Eve must be unable to feasibly compute `$k$` given the public information `$S$`, `$A$`, and `$B$`.
How hard this is for her depends on the details of the `$\mathrm{mix}$` function, specifically how hard it is to invert.
If there were a simple `$\mathrm{unmix}(x, y, r)$` function such that `$\mathrm{unmix}(S, A, 1/2) = a$`, that would be terrible for the security of our protocol—Eve could trivially compute a and b from the public information, and use them to reconstruct the key.
In fact, such a function does exist.

Recall that mixing paint is a [subtractive] process.
That is, each pigment absorbs some wavelengths of light while reflecting others.
The mixture of two pigments absorbs much of the light that either pigment would have absorbed, so adding a pigment to another tends to reduce the number of wavelengths that are strongly reflected.
Unfortunately for us, literal subtraction is too simplistic to be a realistic model of subtractive color mixing; a weighted geometric average is more accurate.
[This excellent article] by Scott Allen Burns explains why.

[subtractive]: https://en.wikipedia.org/wiki/Subtractive_color
[This excellent article]: http://scottburns.us/subtractive-color-mixture/

An accurate color mixing model would consider the absorption/reflection of many different ranges of wavelengths, but to a first approximation you can pretend that light is only composed of three components: the primary colors red, green, and blue.
Either way, pigments can be represented by a vector in `$\mathbb{R}^n$` whose components are the reflectivity of that pigment to different ranges of light wavelengths.
Our mixing function is then

```math
\mathrm{mix}(x, y, r) = x^r * y^{1-r}
```

where `$x^r$` denotes elementwise exponentiation, and `$*$` is elementwise multiplication.
The inverse function is then

```math
\mathrm{unmix}(x, y, r) = (y * x^{-r})^{1/(1-r)}.
```

To break our protocol, Eve simply computes

```math
a = \mathrm{unmix}(S, A, 1/2) = A^2 * S^{-1}
```

and uses it to compute

```math
k = \mathrm{mix}(a, B, 1/3) = A^{2/3} * B^{2/3} * S^{-1/3}.
```

So what's the moral of this story?
I guess the point I'm trying to make is that in cryptography, the devil is in the details.
The video explains that the security comes from the fact that "given a mixed color, it's hard to reverse it in order to find the exact original colors." But in reality, Eve is not just given the mixed colors, she also knows one of the original colors from before they were mixed.
Knowing just `$A$` or `$B$` doesn't help, but together with `$S$`, she can reconstruct the secret colors.
Sure, she may have to buy some expensive lab equipment to accurately measure the reflectivity of the mixture to many different wavelengths, but she only has to buy it once to read an unlimited number of messages between Alice and Bob.
The real Diffie-Hellman protocol remains secure because even knowing both `$A$` and `$S$`, it is hard to invert the "mixing" operation to expose the secret number `$a$` needed to compute the secret key.
