use clap::{App, Arg, ArgMatches, SubCommand};

use mdbook::book::{Book, BookItem};
use mdbook::errors::Error;
use mdbook::preprocess::{CmdPreprocessor, Preprocessor, PreprocessorContext};
use mdbook::utils::new_cmark_parser;

use pulldown_cmark::{Event, Tag, LinkType};

use pulldown_cmark_to_cmark::cmark;

use std::io;
use std::process;

pub struct SiteProc;

impl SiteProc {
    pub fn new() -> SiteProc {
        SiteProc
    }

    pub fn visit_book_item(&self, item: &mut BookItem) {
        if let BookItem::Chapter(chapter) = item {
            // Implement our Markdown extensions
            let mut content = String::with_capacity(2 * chapter.content.len());
            let parser = new_cmark_parser(&chapter.content);
            let mut state = None;
            let mut wait_for_end = false;
            for event in parser {
                match event {
                    Event::Start(Tag::Link(LinkType::Autolink, ref dest, _)) => {
                        if dest.starts_with("fa:") {
                            content.push_str("<i class=\"fa fa-");
                            content.push_str(&dest[3..]);
                            content.push_str("\" aria-hidden=\"true\"></i>");
                            wait_for_end = true;
                        }
                    }
                    Event::End(_) => {
                        if wait_for_end {
                            wait_for_end = false;
                            continue;
                        }
                    }
                    _ => {}
                }

                if !wait_for_end {
                    state = Some(cmark(std::iter::once(event), &mut content, state).unwrap());
                }
            }
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

fn handle_supports(preproc: &SiteProc, sub_args: &ArgMatches) -> ! {
    let renderer = sub_args.value_of("renderer").expect("Required argument");

    if preproc.supports_renderer(&renderer) {
        process::exit(0);
    } else {
        process::exit(1);
    }
}
