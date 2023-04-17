# Besluiten opslag inrichting


## Luchtfoto
We gaan proberen de luchtfoto via AWS te serveren als een test voor het aanschaffen van een integrale beeldmatriaal vieuwer die wellicht ook met raster data (zoals de luchtfoto) om kan gaan.


## Buckets
- Er is gekozen om de verschillende data bronnen in aparte buckets onder te bregen. 
- De opslag is in eerste instantie bedoeld als backup van grote hoeveelheid data.
- De data die opgeslagen moet worden is:
  - Cyclorama, 
  - Obliek, 
  - Ortho, 
  - LiDAR airborne, 
  - LiDAR terrestrisch 

### Toegnag
Iedereen bij GEO krijgt toegang tot de buckets en mag data kunnen toevoegen en verwijderen.


## Backup to cold storage
Er wordt gekeken hoe we de backup zo goedkoop mogelijk kunnen maken en kunnen dupliceren naar een andere regio met bijv. glacier