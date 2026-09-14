# Notes on further supergroup doc/demo work
2026-07-16

Just doing this from the top down. I'll put a star ★ symbol by the most important stuff.

- `The data` section is taking up too much vertical space and has redundant links.
  Hopefully we'll be able to drop most of the datasets.
- As we already discussed, it would be better for the table displays to be nicer
  and consistent. also the `patients` dataset currently overflows its box.
- ★ There is no rhyme or reason that i can tell to the specific examples
  included or their order.
  - This is meant to serve as a doc as well as an examples page. Maybe it
    should start with a listing of the supergroup API with links to examples?
  - I think you've put more importance than necessary on the goal of
    making example code/vars available/repeatable in the console. For non-text
    output, obviously we don't need to be able to recreate in the console.
  - There should be a lot more visualization examples. And the current
    icicle chart is not really readable and should include some interaction.
  - If example code gets big -- make the code box scrollable and
    resizable.
  - A lot of the examples output json, which is not pretty or nice to
    read (e.g., what sequences of statuses do storms move through?) For
    some (e.g., records meet the DAG: attach by node id, then union-safe rollups)
    it seems that you chose json output so the output could include more than
    one thing. Could we use print/printf, something like that? And/or possibly
    include a json viewer with collapse/expand and color?

Before you start creating stuff, we need to have more discussion about what
examples to have and how to structure the page. And what visualizations to 
include.

I'm hoping that all the examples can be drawn from the duckdb patient/vocab data.
