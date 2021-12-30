use clap::{App, Arg, ArgMatches, SubCommand};

use mdbook::book::{Book, BookItem};
use mdbook::errors::Error;
use mdbook::preprocess::{CmdPreprocessor, Preprocessor, PreprocessorContext};
use mdbook::utils::new_cmark_parser;

use pulldown_cmark::{CowStr, Event, LinkType, Tag};

use pulldown_cmark_to_cmark::cmark;

use std::io;
use std::process;

/// Transducer states.
#[derive(Debug, Clone, Copy)]
enum State {
    Default,
    SkipToEnd,
}

/// Our cmark --> cmark transducer.
#[derive(Debug)]
struct Transducer<'a> {
    state: State,
    events: Vec<Event<'a>>,
}

impl<'a> Transducer<'a> {
    fn new() -> Self {
        Self {
            state: State::Default,
            events: Vec::new(),
        }
    }

    fn push(&mut self, mut event: Event<'a>) {
        match self.state {
            State::Default => {
                match event {
                    Event::Start(Tag::Link(LinkType::Autolink, ref dest, _)) => {
                        if let Some(icon) = dest.strip_prefix("fa:") {
                            let html = format!("<i class=\"fa fa-{}\" aria-hidden=\"true\"></i>", icon);
                            event = Event::Html(CowStr::from(html));
                            self.state = State::SkipToEnd;
                        }
                    }
                    _ => {}
                }
            }

            State::SkipToEnd => {
                match event {
                    Event::End(_) => {
                        self.state = State::Default;
                    }
                    _ => {}
                }
                return;
            }
        }

        self.events.push(event);
    }
}

/// Our pre-processor
#[derive(Debug)]
struct SiteProc;

impl SiteProc {
    fn new() -> SiteProc {
        SiteProc
    }

    fn visit_book_item(&self, item: &mut BookItem) {
        if let BookItem::Chapter(chapter) = item {
            // Implement our Markdown extensions
            let mut transducer = Transducer::new();

            for event in new_cmark_parser(&chapter.content, false) {
                transducer.push(event);
            }

            let mut content = String::with_capacity(chapter.content.len());
            cmark(transducer.events.iter(), &mut content, None).unwrap();
            chapter.content = content;
        }
    }
}

impl Preprocessor for SiteProc {
    fn name(&self) -> &str {
        "site"
    }

    fn run(&self, _ctx: &PreprocessorContext, mut book: Book) -> Result<Book, Error> {
        book.for_each_mut(|item| self.visit_book_item(item));

        Ok(book)
    }

    fn supports_renderer(&self, renderer: &str) -> bool {
        renderer == "html"
    }
}

fn main() {
    let preproc = SiteProc::new();

    let matches = App::new("nop-preprocessor")
        .about("A mdbook preprocessor which does precisely nothing")
        .subcommand(
            SubCommand::with_name("supports")
                .arg(Arg::with_name("renderer").required(true))
                .about("Check whether a renderer is supported by this preprocessor"),
        )
        .get_matches();

    if let Some(sub_args) = matches.subcommand_matches("supports") {
        handle_supports(&preproc, sub_args);
    } else if let Err(e) = handle_preprocessing(&preproc) {
        eprintln!("{}", e);
        process::exit(1);
    }
}

fn handle_preprocessing(preproc: &SiteProc) -> Result<(), Error> {
    let (ctx, book) = CmdPreprocessor::parse_input(io::stdin())?;

    if ctx.mdbook_version != mdbook::MDBOOK_VERSION {
        eprintln!(
            "Warning: The {} plugin was built against version {} of mdbook, \
             but we're being called from version {}",
            preproc.name(),
            mdbook::MDBOOK_VERSION,
            ctx.mdbook_version
        );
    }

    let processed_book = preproc.run(&ctx, book)?;
    serde_json::to_writer(io::stdout(), &processed_book)?;

    Ok(())
}

fn handle_supports(preproc: &SiteProc, sub_args: &ArgMatches<'_>) -> ! {
    let renderer = sub_args.value_of("renderer").expect("Required argument");

    if preproc.supports_renderer(renderer) {
        process::exit(0);
    } else {
        process::exit(1);
    }
}
