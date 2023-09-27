# `acap`

<div class="infobar">

[*fa-github* GitHub](https://github.com/tavianator/acap)
[*fa-cubes* crates.io](https://crates.io/crates/acap)
[*fa-book* Docs](https://docs.rs/acap)

</div>


As Close As Possible — [nearest neighbor search] in Rust.

[nearest neighbor search]: https://en.wikipedia.org/wiki/Nearest_neighbor_search

```rust,no_run,noplayground
use acap::euclid::Euclidean;
use acap::vp::VpTree;
use acap::NearestNeighbors;

let tree = VpTree::balanced(vec![
    Euclidean([3, 4]),
    Euclidean([5, 12]),
    Euclidean([8, 15]),
    Euclidean([7, 24]),
]);

let nearest = tree.nearest(&[7, 7]).unwrap();
assert_eq!(nearest.item, &Euclidean([3, 4]));
assert_eq!(nearest.distance, 5);
```
