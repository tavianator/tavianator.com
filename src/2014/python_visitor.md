# The Visitor Pattern in Python

<div class="infobar">

*fa-regular fa-clock* *time-2014-06-19*
*fa-solid fa-user* Tavian Barnes
[*fa-solid fa-comment* Comments](#comments)

</div>


The visitor pattern is tremendously useful when working with certain kinds of information like [abstract syntax trees].
It's basically a poor man's version of [sum types] for languages that don't natively support them.
Unfortunately, they take advantage of function overloading, something which duck-typed languages like Python lack.

[abstract syntax trees]: https://en.wikipedia.org/wiki/Abstract_syntax_tree
[sum types]: https://en.wikipedia.org/wiki/Algebraic_data_type

[This blog post] by Chris Lamb presents a clever workaround, but stops short of giving the actual implementation for the relevant decorators.
The idea looks like this:

[This blog post]: https://chris-lamb.co.uk/posts/visitor-pattern-in-python

```python
class Lion: pass
class Tiger: pass
class Bear: pass

class ZooVisitor:
    @visitor(Lion)
    def visit(self, animal):
        return "Lions"

    @visitor(Tiger)
    def visit(self, animal):
        return "tigers"

    @visitor(Bear)
    def visit(self, animal):
        return "and bears, oh my!"

animals = [Lion(), Tiger(), Bear()]
visitor = ZooVisitor()
print(', '.join(visitor.visit(animal) for animal in animals))
# Prints "Lions, tigers, and bears, oh my!"
```

It looks a little suspicious (after all, we've defined three conflicting methods on the same class), but you can write `@visitor` in a way that makes it work:

```python
# A couple helper functions first

def _qualname(obj):
    """Get the fully-qualified name of an object (including module)."""
    return obj.__module__ + '.' + obj.__qualname__

def _declaring_class(obj):
    """Get the name of the class that declared an object."""
    name = _qualname(obj)
    return name[:name.rfind('.')]

# Stores the actual visitor methods
_methods = {}

# Delegating visitor implementation
def _visitor_impl(self, arg):
    """Actual visitor method implementation."""
    method = _methods[(_qualname(type(self)), type(arg))]
    return method(self, arg)

# The actual @visitor decorator
def visitor(arg_type):
    """Decorator that creates a visitor method."""

    def decorator(fn):
        declaring_class = _declaring_class(fn)
        _methods[(declaring_class, arg_type)] = fn

        # Replace all decorated methods with _visitor_impl
        return _visitor_impl

    return decorator
```

The trick here is that the decorator replaces all the `visit` methods with `_visitor_impl` (redefining an existing method is fine in Python).
But before it does that, it stores the original method in a dictionary, `_methods`, keyed by the visitor class and the desired argument type.
Then, when `visit` is invoked, `_visitor_impl` looks up the appropriate implementation and invokes it based on the argument type.

---


## Comments

> **Kenji Noguchi**
> *fa-regular fa-clock* *time-2015-01-30*
>
> Here is another implementation. \
> <https://github.com/realistschuckle/pyvisitor>
