# Minecraft-like Procedural Generation

## Introduction
### Context
I'm currently a student at the SAE Institute of Geneva in the Games Programming section. For the current module of Computer Graphics, we had to create a Minecraft-like game with our own custom Graphics Engine. My task in this project was to create the procedural generation of the game 
### Constraints
I had a lot of different constraints when creating the map:
* No water
* Map composed of blocks
* Return a 3d array of ints

The map couldn't have any water because it was too complicated for the Engine team to render the water.
I had to return a 3d array of ints, because they represent the blocks ids for our map.


## Biomes

### Shape

#### Voronoi Diagram
![](https://upload.wikimedia.org/wikipedia/commons/d/d9/Voronoi_growth_euclidean.gif)

My first idea was to implement a Voronoi Diagram algorithm. My idea was to generate random dots on the entire map to generate every zones, and then to link every dots with their neighbors to get every zones neighbours. Every zones needed to know the neighbours so it will be simplier later to generate each kind of biomes.

The problem was that I couldn't link the biomes dots with their neighbours and I couldn't easily find the zones neighbours blocks to then lerp them with their neighbours. So I decided to abort this technique.
#### Binary Space Partitionning Without Rectangles
I then decided to work with binary space partitionning with convex shapes. 

I decided first to create a **stuct Zone**:

```Cpp
stuct Zone
{
    Zone(Vector2Int[] b1, Vector2Int[] b2, Vector2Int[] b3, Vector2Int[] b4)
        {
            border1 = b1;
            border2 = b2;
            border3 = b3;
            border4 = b4;
        }
        public Vector2Int[] border1;
        public Vector2Int[] border2;
        public Vector2Int[] border3;
        public Vector2Int[] border4;

}
```
Then I decided to create a function GenerateZones that takes as an argument

Here are the zones creation steps:

* Step 1: Chose two random points of the edges borders to cut
* Step 2: Create children zones
* Step 3: Generate the uncut borders for each children zone
* Step 4: Calculate the unknown borders of each chlidren zone
* Step 5: Use the generate zone function for each children zone

I decided to abord this technique because I still couldn't find the zones neighbours and I couldn't find an efficient way to calculate the map after that and I had no more time to answer to these questions.
#### Binary Space Partitionning With Rectangles
I decided finally to implement a binary space partitionning algorithm with rectangles.

I created zones structures containing their biome and terrain, their neighbours and the blocks they're containing and then I decided to cut each zones like you can see on the picture below:
![](BSP.png | width=100)

With the algorithm I used, I was able to have a map with a lot of different zones that will be useful to spawn the different kind of biomes and terrain.

### Terrain and Biomes
Having a lot of different zones, I decided to implement 3 types of terrains:

* Mountains
* Hills
* Plains

I also decided to implement 3 types of biomes:

* Snow
* Desert
* Green

## Perlin Noise

### Linking Biomes together
