# Announcing Sangria

<div class="infobar">

*fa-clock-o* *time-2014-04-02*
*fa-user* Tavian Barnes
[*fa-github* GitHub](https://github.com/tavianator/sangria)

</div>


[Sangria] is a new project of mine to release various Guice extensions I've been working on recently.
Right now the coolest thing it can do is context-sensitive injections, allowing (among other things) first-class Logger injection for more than just java.util.logging.

[Sangria]: /sangria

For example, so allow [SLF4J] `Logger` injection, all you have to do is this:

[SLF4J]: http://slf4j.org/

```java
import com.google.inject.AbstractModule;
import com.tavianator.sangria.slf4j.SangriaSlf4jModule;

public class YourModule extends AbstractModule {
    @Override
    protected void configure() {
        install(new SangriaSlf4jModule());
    }
}
```

And now this will just work:

```java
import org.slf4j.Logger;

public class YourClass {
    private final Logger logger;

    @Inject
    YourClass(Logger logger) {
        this.logger = logger;
    }
}
```

To create your own context-sensitive injections, implement the [`ContextSensitiveProvider`] interface:

[`ContextSensitiveProvider`]: /sangria/apidocs/com/tavianator/sangria/contextual/ContextSensitiveProvider.html

```java
import com.tavianator.sangria.contextual.ContextSensitiveProvider;

public class YourProvider implements ContextSensitiveProvider<YourType> {
    @Override
    public YourType getInContext(InjectionPoint injectionPoint) {
        // Create an instance. The type you're being injected into is available
        // as injectionPoint.getDeclaringType().
    }

    @Override
    public YourType getInUnknownContext() {
        // Create an instance for an unknown context. The context will be
        // unknown for Provider<YourType> bindings and for Provider method
        // parameters. If the context is required, it is valid to throw an
        // exception here.
    }
}
```

Then use [`ContextSensitiveBinder`] to bind it:

[`ContextSensitiveBinder`]: /sangria/apidocs/com/tavianator/sangria/contextual/ContextSensitiveBinder.html

```java
import com.google.inject.AbstractModule;
import com.tavianator.sangria.contextual.ContextSensitiveBinder;

public class YourModule extends AbstractModule {
    @Override
    protected void configure() {
        ContextSensitiveBinder.create(binder())
                .bind(YourType.class)
                .toContextSensitiveProvider(YourProvider.class);
    }
}
```

Sangria is released under the [Apache License, Version 2.0].

[Apache License, Version 2.0]: http://www.apache.org/licenses/LICENSE-2.0.html
