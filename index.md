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
My first idea was to implement a Voronoi Diagram algorithm. My idea was to generate random dots on the entire map to generate every zones, and then to link every dots with their neighbors to get every zones neighbours. Every zones needed to know the neighbours so it will be simplier later to generate each kind of biomes.

The problem was that I couldn't link the biomes dots with their neighbours and I couldn't easily find the zones neighbours blocks to then lerp them with their neighbours. So I decided to abort this technique.
#### Binary Space Partitionning Without Rectangles
I then decided to work with binary space partitionning with convex shapes. 

I decided first to create a **stuct Zone**

Here are the zones creation steps:

* Step 1: Chose two random points of the edges borders to cut
* Step 2: Create 
#### Binary Space Partitionning With Rectangles

### Terrain

### Biomes Types

## Perlin Noise

### Linking Biomes together
