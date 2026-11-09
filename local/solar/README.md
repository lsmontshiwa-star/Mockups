# DS solar template

One page, one day: scrolling moves the clock from 05:40 to midnight. The sky, the sun and a dot-matrix street follow the time; the header shows an example 5 kW system (solar kW, battery %, grid on/off). At 18:00 the pinned load-shedding chapter switches the street off and leaves this house lit.

- `template.html` the page, with `{{fields}}`. Optional blocks sit inside `<!--if:field-->...<!--/if:field-->` and vanish when the field is empty, so a lead without reviews or numbers never shows invented ones.
- `demos/<slug>.json` one business per file. `python3 local/solar/build.py` writes `local/<slug>/index.html` (noindex, with the ds-view tracker copied from `local/template.html`).
- Lists (`areas`, `credentials`, `brands`) are comma-separated. `accent` is the business colour (default sun amber).
- `credentials` only lists what the business actually holds (PV GreenCard, CoC, etc.). Never fill it in for them.
- Photos: the business's own Google photos for `work_*` and `service_*_image`; `img/` holds Unsplash stock for the demo only (sources in `credits.txt`).
- Demo: digitalswitch.co.za/local/demo-solar/ (Sunvault Solar is a sample business; its figures and reviews are marked as samples).
