# Route Map Maker

A browser tool for making annotated security / route maps on real satellite imagery —
police icons, callout boxes, route arrows, and a legend — then exporting to PNG.

## Run it

No build step. Two options:

- **Just open it:** double-click `index.html` (needs internet for the map tiles).
- **Local server** (recommended, avoids any browser file-access limits):
  ```
  npx --yes serve -l 5599 .
  ```
  then open http://localhost:5599

## How to use

1. **Base map** — pick Satellite, Street, or Hybrid (satellite + labels).
2. **Add icon** — click a tool (Mobile Unit, HC/PC, Lady Police, ASI, Scout,
   Barricade, Parking, CCTV, Point), then click the map to drop it.
   Double-click an icon to edit its label; drag to move it.
3. **Callout box** — click the tool, click the map. Double-click to edit the
   title/details; drag to move.
4. **Route arrow** — click the tool, then click points on the map to draw a path.
   Double-click to finish. Drag the white vertex dots to adjust. Change colour/width
   in the sidebar while the route is selected.
5. **Select / move** — click an item to select it, press `Delete` to remove it.
6. **Legend** — auto-fills as you add icon types; rename entries in the sidebar or
   toggle it off.
7. **Title** — click the title on the map to edit it.

## Save / export

- **Save** — stores the project in your browser (localStorage).
- **Export / Import** — download or load the project as a `.json` file.
- **Export PNG** — renders the current map + annotations to a PNG image.

## Tech

Plain HTML/CSS/JS. [Leaflet](https://leafletjs.com) for the map,
Esri World Imagery + OpenStreetMap tiles (no API key),
`leaflet-polylinedecorator` for arrowheads, `html2canvas` for PNG export.
