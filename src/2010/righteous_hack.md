# Righteous hack: getting 2<sup>63</sup> - 1 points in a silly Facebook game

<div class="infobar">

<fa:clock-o> 2010-12-13
<fa:user> Tavian Barnes
[<fa:comments> Comments](#comments)

</div>


Security through obscurity doesn't work.
Every once in a while I like to prove this fact, by getting worldwide high scores on vulnerable leaderboards.
The first time I did this was to [Area Flat 3] (which was an awesome game when I was in elementary school, and is still pretty fun).
Check the [all-time top 100 scores] for H4X0R (I know, not very original; I was 13, sue me).
But that hack was child's play compared to this one.

[Area Flat 3]: http://www.shiftup.net/java/AF3/AF3_e.html
[all-time top 100 scores]: http://www.shiftup.net/java/AF3/cgi/addScoreAF3.cgi?md=view&y=0&p4=e&p5=

Recently I noticed that a Facebook game called [Fast Typer 2] was becoming popular with my Facebook friends.
I played it a few times and got the third-best score of all my friends when I noticed that the global leaderboard had some unbelievable high scores.
Like 9223372036854775807.
I was struck by the fact that: a) they use at least signed 64-bit integers to hold people's scores; and b) the leaderboard is vulnerable.
In fact, the top 27 scores were obvious hacks.
So, I got to work.

[Fast Typer 2]: http://apps.facebook.com/mj-fast-typer/?type=discovery

The first step is to enable the [Tamper Data] Firefox extension.
I usually run Chrome, but I keep Firefox around for extensions like this.
After playing the game again, I'd logged all the necessary communications to submit a high score.
The Flash game POSTs to a few servlets at http://minifb-typer.mindjolt.com/servlet/\<servlet>, with the NextSubmitScore servlet looking particularly interesting.
Examining the POST data from that request, I found that there's a "score=" parameter right there.
So I played again, but tampered with that request.
I changed the value of the "score=" parameter to something much higher, and the game told me I had a new personal best score -- but with my real score from the game, not the tampered one!
Turns out that "score=" is a red herring.

[Tamper Data]: http://tamperdata.mozdev.org/

Next, I had to decompile the SWF file itself, to figure out what was going on.
I used swfdump from swftools, but it just dumps the AVM2 opcodes.
There's no true SWF decompilers that work for ActionScript 3 on Linux, it seems.
No matter, soon I had figured out that the game itself loads an internal API from another SWF file, "api_local_as3.swf".
After reading through some of the functions I finally found the important one, "createSession".
This function makes an associative array that holds your score, a "token" which is always 1, and "delta" and "deltaAbs", with unidentified purpose.
This array is converted to a string, then RC4 encrypted, with an 8-byte key, which is -- well, I don't want to spoil the fun, but it starts with "537E".
True enough, the NextSubmitScore requests have a "session=" parameter, with a giant hex value.
Decrypted, it looks like this:

> score=227&delta=137860&deltaAbs=137860&token=1

So the procedure to hack the game is this: play the game, tamper with the "NextSubmitScore" request, decrypt the "session=" parameter, change the score to a gigantic number, encrypt the new session string, replace the request parameter's value with your tampered one, and submit it.
If you do it right, the game will greet you with "Congratulations! You've just set a record for all of Facebook!"

---


## Comments

> **lloyd**
> <fa:clock-o> 2010-12-15
>
> i just cant get the 8-byte key
>
> > <fa:user> [**Tavian Barnes**](/)
> > <fa:clock-o> 2010-12-15
> >
> > Look for the RC4_KEY variable.

> **JC**
> <fa:clock-o> 2010-12-21
>
> Hello, \
> I'm currently trying to modify a different game but also from MindJolt. \
> It seems Googling for "servlet/NextSubmitScore" I was able to find your page. \
> I'm also having trouble finding the RC4 key. \
> Do we dump the api_as2_local.swf? ie. swfdump -D api_as2_local.swf? \
>
> I'm not able to find the RC4_KEY variable anywhere :S
>
> Also is there an alternative to Tamper Data?
> That plugin no longer works for the newer version of firefox.
>
> BTW I had initially wanted to get an app such as Temper Data to change SCORE=# in the HTTP/POST packet for NextSubmitScore but it seems it's only red herring :S
>
> -JC
>
> > **JC**
> > <fa:clock-o> 2010-12-21
> >
> > NM found the RC4_KEY... Now I gotta figure out how to decrypt/encrypt string given key. :D

> **Nick**
> <fa:clock-o> 2011-01-11
>
> Very cool.
> After getting the #1 legit high score for the week on that typing game, I was curious about the hacked ones.
> Of course, typing your name into Facebook or Google didn't reveal much, but interestingly enough the ajax requests on Facebook for the high scorers includes their UIDs as well.
> I'm decent at binary disassembly but don't know too much at swf decompiling.
> Good job though!
>
> You have a pretty neat website -- just thought I'd share that.
>
> > <fa:user> [**Tavian Barnes**](/)
> > <fa:clock-o> 2011-01-11
> >
> > Thanks.
> > Why do an AJAX request for the high scorers anyway?
> > Not that I know too much about the Facebook platform, but it seems pretty roundabout.
> >
> > If you're good with binary stuff then you can always mess with the address space of the Flash game too; I think something like that is how most of the hacked scores happened.
> > But you've only got a signed 32-bit integer to work with when you do it that way, so the 4 or so 64-bit scores must've been done this way.
> >
> > > **Nick**
> > > <fa:clock-o> 2011-01-12
> > >
> > > Oh, I wasn't writing my own requests -- I was just reading Facebook's with Firebug.
> > > As far as I know, that's the only way to find the profile id's of the high scorers.
> > >
> > > Yeah, I was wondering why some of the high scores were constrained to 32 bits and a few were 64 bits.
