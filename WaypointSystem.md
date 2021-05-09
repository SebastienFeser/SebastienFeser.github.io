# Waypoint System to get the placer’s placement in a racing game
## Context
We’ve worked on a video game project during our third year of Bachelor at the SAE Institute of Geneva in Games Programming. Our objective was to create a racing game for the Nintendo Switch, using a custom Game Engine in C++ that was developed by our teacher and by us. 
personal
Our game named “AerRacers” is a multiplayer pod racing game, where the player can go very fast, but has to control his speed to avoid crashing into walls which will cost him a lot of time. The particularity of that video game is that the player can control each Rotor of the spaceship with the joystick, and by doing this, he’ll control the speed of the Ship.

For this project, I was assigned as the Lead Project, the Lead Gameplay Programmer, and the Lead Game Designer. We had 5 months to create a game, we started on September 17th 2020 and the project ended on May 07th 2021.
## Player’s positions in a race
An important feature in a multiplayer racing game is to know the positioning of the players. There are several ways to get it, you could’ve imagined a system using triggers or chunks, but I decided to use a waypoint system for these reasons:
* Uses simple maths (Dot product)
* Easier to implement in our engine


## The Waypoint System
The waypoint system I’ve imagined uses a waypoint map in which the player’s position is calculated between the waypoints the player is in. The waypoint manager keeps a target waypoint to calculate the player’s position and update the target waypoint, by calculating the dot product between the vector Player-Waypoint and the vector Waypoint-NextWaypoint.

## Waypoint
The waypoint I decided to created contains a lot of different data:
* **Position**: Position of the waypoint
* **Index**: Index of the waypoint
* **Next Waypoint Index**: Index of the next Waypoint
* **Previous Waypoint Index**: Index of the previous waypoint
* **Length**: Length between this waypoint and the next waypoint
* **Normalized Next Vector**: Normalized vector between this waypoint and the next waypoint

## PlayerPositionData


I decided to store every piece of information about the player’s positions in a structure called “PlayerPositionData”. All information about the ship’s position of each player are stored here:
* **std::array<RacePlacement, 4> racePlacement**: keeps the players placement in race
* **std::array<float, 4> positionInWaypoint**: keeps the dot product between the vector between the player and the current waypoint and the current waypoint normalized index
* **std::array<WaypointIndex, 4> waypoints**: keeps the current waypoint used to update the player position in the race
* **std::array<WaypointsCount, 4> waypointsCount**: keeps the count of the waypoints 

The PlayerPositionData are stored in an array of size 4 which corresponds to the maximum number of players the game can have.

## Waypoint Manager

To manage our waypoint, I’ve created a waypoint manager that stores the waypoints and updates the positions of the players in the race. Let me explain some of the functions implemented:
* **void AddWaypointFromJson(Entity entity, const json& jsonComponent)**: Called when loading the scene, to get each waypoint elements in the scene JSON,
* **CalculatePlayerPosition(Vec3f playerPosition, PlayerId playerId)**: Calculates every waypoints position elements
* **void CalculatePlayerPlacement()**: Calculates the players placement in the race using the data calculated by the CalculatePlayerPosition function.
* **void StartDetection()**: Used to start the waypoint detection and to get the player’s data.
* **void RestartWaypointManager()**: Used to restart the waypoint manager when going back to the main menu.
## Create the waypoints
Before updating the player’s position in the Waypoint Manager, I had to create our waypoints and store them in the Waypoint Manager. To do so, we went through these iterations: 
1. Place the Waypoints on the Unity map
2. Export the Waypoints with our Unity Scene Exporter tool
3. Import the Waypoints with our Neko Scene Importer tool
4. Place the waypoints in the Waypoint Manager array 
5. Updating the waypoint system
## Updating PlayerPositionData
To update the player’s positions’ data, we are going through different steps
1. Calculate the vector between the ship position and the waypoint of each ship
2. Calculate the dot product between this vector and the waypoint normalized next vector of each ship
3. Check the dot product value of each ship
    1. If higher than the next length, change the waypoint in the “PlayerPositionData” to the next waypoint, and the waypointCount += 1
    2. Else if negative, check if it’s higher than the previous wp length
        1. If negative, change the waypoint to the previous one and the waypointCount -= 1
        2. Else, continue
    3. Else, continue
4. When every value is updated, store the value in the PlayerPositionData of the Waypoint Manager
5. CalculatePlayerPlacement
    1.Check if every player have won
        1. If true, tell the gameManager to end the game
        2. If false, continue
    2. Compare the values of every ship, by counting the waypoints and comparing the positionInWaypoint if two players have the same waypoint count, to create the placement
## Special situations
There are some situations in which the waypoint system I imagined had to be adapted.

### Checking if the dot is negative
At first, when the dot product of the shipping vector and the normalized next waypoint were negative, I set the player target waypoint to the previous one. The problem was that in some situations, the dot could be at the same time negative and the dot of the previous waypoint higher than the previous length which changed the waypoint at each frame because the player was between them.

To solve this, I simply added a check if the value was negative, checking if the dot product was higher than the previous waypoint length or not.

### Multiple paths
Another situation we had at first, was when the game had multiple paths which changed the amount of next or previous waypoints a waypoint could have.

To solve this, I created a boolean that checked if the player had multiple waypoints next, and then checked for both waypoints if the player had to change waypoints or not. I also added a check to see from which waypoint the player was the nearest to calculate the waypoint’s value with the correct waypoint.

In the end, we decided not to implement a multiple path waypoint system, because it wasn’t really necessary for the map we created, even if I solved this problem with this system.
## Problems encountered
### Scene Exportation
One of the main problems I encountered during the development of the waypoint system, was the fact that it was the first time I worked on the Neko Engine. The most complicated part was to export the waypoints from Unity and to load them in the Neko Engine correctly. I had to look at the code my colleagues had written which could’ve been easier if I was more curious about what they were doing during the development of the project. 

For example, a problem I encountered when exporting the Waypoints from the Unity Scene was the fact that the x-axis was inverted in the Neko Engine. I thought first that the problem went from the logic behind the implementation of the Waypoint System, but in fact, I lost a bunch of time trying to solve my system.

In the end, I’ve solved this problem by asking a lot of precise questions about the problems I met while loading the scene.
## What I learned
### Personal Skills
I learned a lot of different things about my personnal skills.

I was at first sure that it would be much harder for me to code in C++, but in the end, it wasn’t very hard to switch between C# and C++. 

I learned that I liked creating systems more than programming gameplay features because it’s easier to know what you're doing when you don’t depend too much on other people’s code.
