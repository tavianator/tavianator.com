# bistring

<div class="infobar">

[*fa-github* GitHub](https://github.com/microsoft/bistring)
[*fa-cubes* pypi](https://pypi.org/project/bistring/)
[*fa-cubes* npm](https://www.npmjs.com/package/bistring)
[*fa-book* Docs](https://bistring.readthedocs.io/en/latest/)

</div>


The bistring library provides non-destructive versions of common string processing operations like normalization, case folding, and find/replace.
Each bistring remembers the original string, and how its substrings map to substrings of the modified version.

For example:

```python
>>> from bistring import bistr
>>> s = bistr('𝕿𝖍𝖊 𝖖𝖚𝖎𝖈𝖐, 𝖇𝖗𝖔𝖜𝖓 🦊 𝖏𝖚𝖒𝖕𝖘 𝖔𝖛𝖊𝖗 𝖙𝖍𝖊 𝖑𝖆𝖟𝖞 🐶')
>>> s = s.normalize('NFKD')     # Unicode normalization
>>> s = s.casefold()            # Case-insensitivity
>>> s = s.replace('🦊', 'fox')  # Replace emoji with text
>>> s = s.replace('🐶', 'dog')
>>> s = s.sub(r'[^\w\s]+', '')  # Strip everything but letters and spaces
>>> s = s[:19]                  # Extract a substring
>>> s.modified                  # The modified substring, after changes
'the quick brown fox'
>>> s.original                  # The original substring, before changes
'𝕿𝖍𝖊 𝖖𝖚𝖎𝖈𝖐, 𝖇𝖗𝖔𝖜𝖓 🦊'
```


## Demo

<style>
#wrapper {
    color: var(--icons);
}
#code {
    width: 100%;
    margin-left: 32px;
    max-width: 736px;
    color: var(--sidebar-fg);
    background: var(--sidebar-bg);
    border: 1px solid var(--sidebar-non-existant);
}
.label {
    font-family: monospace;
    color: var(--icons);
    user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    -webkit-user-select: none;
}
.selectable {
    white-space: pre;
}
.selectable::selection {
    color: var(--bg);
    background: var(--fg);
}
</style>
<p>
Try selecting some of the &ldquo;original&rdquo; or &ldquo;modified&rdquo; text below, or editing the code block!
</p>
<pre id="wrapper">
import BiString, * as bistring from "bistring";&#10;
let s = (function() {
<textarea id="code" rows="8" spellcheck="false">
let s = new BiString("𝕿𝖍𝖊 𝖖𝖚𝖎𝖈𝖐, 𝖇𝖗𝖔𝖜𝖓 🦊 𝖏𝖚𝖒𝖕𝖘 𝖔𝖛𝖊𝖗 𝖙𝖍𝖊 𝖑𝖆𝖟𝖞 🐶");
s = s.normalize("NFKD");
s = s.toLowerCase();
s = s.replace("🦊", "fox");
s = s.replace("🐶", "dog");
s = s.replace(/[^\w\s]+/g, "");
return s;</textarea>
})();</pre>
<p>
<span class="label">s.original == "</span><span class="selectable" id="original"></span><span class="label">"</span>
</p>
<p>
<span class="label">s.modified == "</span><span class="selectable" id="modified"></span><span class="label">"</span>
</p>
<script src="bistring.browser.js"></script>
