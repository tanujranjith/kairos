Kairos — Project Context for Codex

Purpose of this file

This document is the authoritative high-level context for Kairos, a browser-first open-world driving and motorsport game. Use it to understand the product vision, hard constraints, quality bar, and intended technical direction before creating the implementation plan.

Do not treat this document as the final engineering plan. The immediate Codex task is to turn this context into a much more detailed, staged implementation plan with architecture decisions, milestones, technical risks, validation steps, performance budgets, asset strategy, and testing criteria.

The repository will also contain visual mockups generated for Kairos. Treat those images as the primary visual and UI direction. They are concept targets, not literal pixel-perfect specifications.

1. Project identity

Name Kairos

Meaning Kairos is a Greek concept referring to the right, critical, or opportune moment. The name fits the project because great driving is built around timing braking at the right moment, turning in at the right moment, shifting at the right moment, overtaking at the right moment, and finding a flow through the road.

The identity should feel premium, restrained, cinematic, and modern. Avoid an overly arcade-like presentation.

Kairos should feel like one cohesive driving world rather than several disconnected game demos.

2. Core vision

Kairos is intended to be a realistic, browser-native open-world driving game with two major experiences

Free Drive

Explore a large seamless road network.

Drive without being forced into missions.

Enjoy the act of driving itself.

Encounter traffic, scenic roads, highways, cities, mountains, tunnels, bridges, and other believable environments.

Optional activities can exist, but the player should never feel forced into them.

Motorsport

Serious circuit driving and racing.

Formula-style open-wheel cars.

GT3-style race cars.

Potentially endurance prototypes and additional classes later.

Proper circuits, lap timing, sectors, qualifying, races, tirefuel systems, racing AI, and track-specific vehicle behavior.

The game should aim for a visual and experiential tone inspired by high-end modern driving games, while remaining an original project with original vehicles, locations, branding, UI, and assets.

3. Execution mandate build the complete game in one continuous goal

This project is intentionally designed as a maximum-capability stress test for GPT-6 AstraCodex.

The objective is not to stop after a prototype, MVP, vertical slice, architecture skeleton, or partial implementation. Codex should use its highest-autonomy workflow, including goal mode when available, and treat the task as one continuous end-to-end goal

Build Kairos into the strongest complete, playable, browser-native open-world driving and motorsport game that can be produced within the available environment, and keep working until that goal is satisfied as fully as possible.

This changes the execution philosophy substantially

Do not hand back a plan and wait for another prompt before implementation.

Do not stop because a milestone was completed.

Do not stop after the first playable build.

Do not stop after creating the architecture.

Do not stop after proving the renderer, physics, map, or UI separately.

Do not deliberately defer major requested systems to a hypothetical future phase merely because they are difficult.

Do not turn difficult systems into static mockups or placeholder screens.

Do not leave obvious TODOs when there is enough information and tool access to continue.

Do not ask the user to manually wire systems together unless a hard external constraint makes automation impossible.

Do not repeatedly request approval for ordinary engineering decisions. Make reasonable decisions autonomously and document them.

Do not interpret one go as write everything at once without testing. Internally, Codex should still build, run, test, profile, debug, and iterate in a rational sequence. The distinction is that all of those phases belong to one uninterrupted goal rather than separate user-authorized projects.

Milestones are therefore internal execution checkpoints, not stopping points.

The desired loop is

understand repository + mockups
        ↓
produce internal implementation plan
        ↓
set up project
        ↓
implement first runnable slice
        ↓
runtest
        ↓
fix
        ↓
expand systems
        ↓
runtestprofile
        ↓
fixrefactor
        ↓
add remaining major features
        ↓
integrate all modes
        ↓
optimize
        ↓
polish
        ↓
deploy
        ↓
test deployed build
        ↓
continue fixingimproving until the full goal is met

If a particular desired feature proves infeasible in the browser or current environment, Codex should

determine precisely why;

implement the strongest practical alternative;

preserve the intended user experience where possible;

document the compromise;

continue with the rest of the game rather than stopping the overall task.

The project should be treated like a long-running engineering objective, not a short code-generation request.

4. Hard platform constraint

This is the most important constraint in the entire project.

The game must run locally inside a normal browser on a secondary Windows laptop where

Installing software is not allowed.

Running unapproved native executables is not allowed.

Opening normal websites in a browser is allowed.

The game must not require Unreal Engine, Unity Player, a native launcher, or an installed runtime.

The game must not rely on videogame streaming from another computer.

The secondary laptop itself must perform the game simulation and rendering.

The desired user experience is

Open browser
    ↓
Visit Kairos URL
    ↓
Game assets load
    ↓
Game runs locally in the browser

There should be no EXE, installer, game-streaming service, or remote-rendering dependency.

5. Hosting and delivery model

The intended deployment model is a normal HTTPS website, initially likely hosted on Vercel.

Example

httpskairos.vercel.app

The exact domain is not important yet.

The browser should download the application and assets, then run the game locally using the laptop's own CPU and GPU.

If the game eventually becomes too large for a simple static deployment, large assets may be moved to an appropriate CDN or object-storage service while the application shell remains hosted on Vercel.

The architecture should support

versioned builds

cacheable static assets

compressed texturesmodels

chunked world loading

incremental content growth

6. Important network lesson from the first prototype

A small Babylon test was previously opened as a local HTML file. The page itself loaded, but Babylon.js failed because the browsernetwork could not retrieve Babylon from its public CDN.

Therefore

Do not assume third-party CDNs will always be reachable.

Critical runtime dependencies should be bundled with the project or served from infrastructure controlled by the project.

Prefer same-origin delivery for core runtime files where practical.

Do not make Kairos depend on cdn.babylonjs.com or similar public runtime CDNs.

The final game should be tested from an actual HTTPS deployment rather than primarily through file URLs.

This restriction is important enough to account for in the plan from the beginning.

7. Preferred technology direction

The current preferred stack is

TypeScript

Babylon.js

WebGPU as the preferred renderer

WebGL2 fallback where necessary

Havok WebAssembly andor custom vehicle-physics logic

glTFGLB for 3D asset delivery

compressed browser-friendly textures such as KTX2Basis

modern web audio APIs

browser-native storage for local settingsprogress where appropriate

This is a strong preference, not an instruction to blindly force every system through Babylon APIs. Codex should still evaluate where custom systems are necessary.

The main reason for Babylon.js over Three.js is that Babylon is closer to a game engine and already provides substantial infrastructure for

rendering

materials

cameras

animation

particles

scene management

physics integration

asset loading

post-processing

WebGPU

Kairos should spend engineering effort on driving, world simulation, performance, AI, content, and polish rather than rebuilding basic engine infrastructure unnecessarily.

8. Visual target

The repository will contain mockup images showing the intended look.

Use those mockups as the primary reference for

atmosphere

UI language

camera composition

lighting

garage presentation

open-world map presentation

motorsport HUD

free-drive HUD

The target visual character includes

cinematic golden-hour lighting

high-quality PBR vehicle materials

realistic road surfaces

dense but believable roadside detail

mountains, forests, water, city areas, and highways

strong environmental depth and atmosphere

wet-road reflections in rain

restrained bloom and post-processing

clean, premium HUD design

modern automotive presentation

The goal is not to imitate any single existing commercial game exactly. Kairos should have its own visual identity.

9. Vehicle philosophy

Driving feel is the single most important gameplay system.

Kairos should not feel like a generic rigid body with four wheels attached.

The eventual vehicle model should account for concepts such as

vehicle mass

center of gravity

wheelbase

track width

suspension springdamper behavior

anti-roll behavior

suspension travel

wheel loads

longitudinal tire force

lateral tire force

slip ratio

slip angle

progressive loss of grip

friction-circle behavior

braking

ABS

traction control

stability control

engine torque curves

gearing

drivetrain inertia

differential behavior

engine braking

steering ratio

aerodynamic drag

downforce

surface friction

weight transfer

Different vehicle classes must feel meaningfully different.

Examples

Road sports cars should feel compliant and progressively lose grip.

GT3-style cars should feel heavier, stiffer, more planted, and electronically assisted.

Formula-style cars should be highly dependent on aerodynamic load and should behave very differently at high and low speeds.

FWD, RWD, and AWD should not behave like cosmetic labels.

Do not prioritize a huge vehicle roster before the physics model is convincing.

10. Vehicle roster direction

Start with a deliberately small number of polished fictional vehicles.

Initial categories should eventually include

lightweight road sports car

powerful RWD sportssupercar

AWD performance car

grand-tourerperformance GT

GT3-style race car

Formula-style open-wheel race car

Potential later additions

endurance prototype

performance SUV

lower-powered club racing car

additional road classes

Vehicles should be original designs. Do not use protected manufacturer logos, liveries, or exact copies of real productionracing vehicles.

11. Free Drive experience

Free Drive should be enjoyable with no objective at all.

Core ideas

seamless exploration

believable traffic

highways

mountain roads

city streets

suburban roads

rural roads

industrial roads

tunnels

bridges

scenic routes

parking areas

garages

gasservice areas

changing weather

changing time of day

Optional activities may include

speed traps

point-to-point time trials

drift zones

scenic routes

road discovery

driving challenges

personal bests

These should remain optional and should not clutter the screen.

12. Motorsport experience

Motorsport should feel substantially more serious than Free Drive.

Target features over time

dedicated racing circuits

multiple car classes

Practice

Qualifying

Quick Race

Race Weekend

grid starts

lap timing

sector timing

personal bests

race position

track limits

penalties

tire wear

tire temperature

fuel use

brake temperature if feasible

pit logic

racing AI

flags

race results

Formula and GT racing must not simply reuse the same physics configuration with different speed multipliers.

13. World design

The open world should feel authored and believable rather than like a huge procedural terrain with roads stamped onto it.

Desired regions include

dense citydowntown

suburbs

countryside

farmland

industrial district

forests

mountaincanyon roads

highways

interchanges

tunnels

bridges

lakesriverscoastal areas where appropriate

at least one dedicated motorsport complex

Driving roads should include

sweeping high-speed sections

technical corners

switchbacks

long straights

elevation changes

narrow scenic roads

multilane highways

urban intersections

onoff ramps

believable road connectivity

World size should be chosen around quality and performance, not bragging rights.

A smaller dense world is preferable to a giant empty world.

14. World streaming

The entire open world should not be loaded at once.

Codex should plan for

spatial chunkingcells

asynchronous asset loading

LODs

instancing

simplified distant geometry

simplified distant trafficAI

vegetation density scaling

texture streaming

asset caching

world-cell prioritization around the player

A representative mental model

Immediate player area
full geometry + physics + high detail

Nearby cells
normal world detail + active traffic

Far cells
simplified geometry + low-cost simulation

Very far
terrainskyline only or unloaded

This is fundamental to making the project viable in a browser.

15. Traffic AI

Free Drive traffic should eventually

follow lanes

obey traffic direction

stop at intersections

react to traffic lights

maintain following distance

change lanes

merge

use plausible highway speeds

avoid obvious collisions

recover reasonably from unusual situations

Traffic density should be scalable.

Traffic AI and racing AI should be treated as separate systems.

16. Racing AI

Racing AI should eventually understand

racing line

target corner speed

braking zones

overtaking opportunities

defending

recovery after mistakes

avoiding obvious contact

driver-specific pace

aggressiveness

consistency

Difficulty should affect actual driver performance and decision-making rather than granting impossible physics.

17. Cameras

Target camera modes

third-person chase

close chase

cockpit

hooddashboard

bumper

optional photofree camera

The chase camera should feel polished rather than rigidly attached to the car.

Useful effects

velocity-aware follow behavior

subtle lateral lag

speed-based FOV

collision avoidance

restrained shake

suspensionbody-motion response

Cockpit movement should remain subtle and readable.

18. Audio

Audio is part of the driving model, not just decoration.

Long-term targets

RPM-responsive engine sound

load-sensitive engineexhaust character

intakeexhaustmechanical layers

transmission whine for race cars

turbosupercharger sound where appropriate

shift events

tire scrubsqueal driven by slip

gravel impacts

road noise

wind noise

suspension impacts

collision audio

tunnelreverb response

different interiorexterior mixes

Audio systems should be data-driven where possible.

19. Weather and time

Desired eventual systems

dynamic time of day

sunrise

daytime

golden hour

sunset

night

clear

partly cloudy

overcast

rain

storm if practical

Rain should affect

road appearance

reflections

tire grip

spray

visibility

Weather should influence driving, not just visuals.

20. UI direction

The mockups define the intended visual language.

Primary screens

main menu

Free Drive

Motorsport

Garage

vehicle selection

customization

world map

settings

pause

results

Free Drive HUD should remain minimal

speed

gear

tachometer

navigationminimap

critical vehicle state

optional activity information

Motorsport HUD can be denser

position

lap

timing delta

sectors

fuel

tire state

race status

track map

The interface should feel premium and understated, not like a mobile-game HUD.

21. Controls

Primary targets

keyboard

mouse where useful for UIcamera

Xbox-style controllergamepad

Potential later support

steering wheels if browser APIs and platform limitations make this practical

For keyboard

input smoothing is necessary

For controller

deadzone settings

steering curves

speed-sensitive steering

progressive throttlebrake input

Do not compromise the underlying physics model merely to make keyboard driving easier.

22. Graphics scalability

The same game must be able to run on

the secondary laptop

more capable desktop hardware

Therefore graphics must scale.

Expected presets

Low

Medium

High

Ultra

Potential scalable features

render resolution

dynamic resolution

shadow quality

shadow distance

reflections

post-processing

vegetation density

traffic density

world draw distance

texture quality

particle density

mirror quality

environmental detail

anisotropy

antialiasing strategy

Kairos should detect hardware capabilities and choose sensible defaults, but users should retain manual control.

23. Performance philosophy

Browser constraints are real and should shape the architecture from the start.

Do not build the full content set and attempt optimization at the end.

Performance should be continuously measured.

Important concerns

CPU simulation cost

GPU cost

browser memory

WebAssembly memory

draw calls

texture memory

shader complexity

garbage collection

asset loading stalls

AI cost

physics update rate

number of dynamic bodies

traffic simulation range

shadow cost

The final plan should define measurable budgets instead of relying on vague goals.

24. Continuous full-build development philosophy

Kairos should still be engineered in a technically rational order, but Codex must carry that order through to the complete game in the same goal execution.

Do not interpret this section as permission to stop after any intermediate stage.

A strong internal sequence is

1. Repository inspection + mockup inspection
2. Toolchainbootstrap
3. Browser compatibility harness
4. Renderinginput foundation
5. One high-quality drivable vehicle
6. Vehicle physics validation
7. Roadterrain foundation
8. CameraaudioHUD integration
9. Small open-world slice
10. World streaming
11. Expanded road network and biomes
12. Traffic simulation
13. Garage + vehicle selection
14. Additional road cars
15. Motorsport circuit
16. GT3 physics + race session systems
17. Formula physics + race session systems
18. Racing AI
19. Weather + time of day
20. Map + navigation + activities
21. Savesettingsprogression
22. Performance optimization
23. Visual and audio polish
24. Deployment
25. Deployed-build validation
26. Bug fixing and final refinement

These are checkpoints inside one continuous task. After completing one, continue immediately to the next unless a hard blocker requires user input.

Codex should repeatedly run the project during development. A single giant untested code dump is not the goal. The challenge is to autonomously carry a complex project through the complete software-development lifecycle in one sustained run.

25. Quality priorities

When tradeoffs are necessary, prioritize approximately in this order

Driving feel

Stable browser performance

Vehicle physics

Roadworld quality

Vehicle visual quality

Camera feel

Renderingatmosphere

Free Drive experience

Motorsport quality

AI

Audio

Weathertime

breadth of content

Examples

Six excellent cars are better than fifty mediocre cars.

One excellent circuit is better than five unfinished circuits.

A dense 10 km² world is better than a lifeless 100 km² world.

A believable car is more important than another menu or collectible system.

26. Scope discipline without premature scope reduction

This project intentionally aims beyond a normal MVP. Codex should not respond to ambition by automatically shrinking the requested game to a tiny demo.

Instead

preserve the full product vision;

use scalable implementations;

prefer proceduraldata-driven systems when they improve breadth without destroying quality;

reuse strong abstractions across vehicles, tracks, roads, UI, AI, and environments;

automate content-generation steps where appropriate;

use LODs, instancing, streaming, and data-driven configuration to make the breadth technically viable;

make intelligent qualityperformance tradeoffs instead of deleting entire pillars of the game.

When time or environment limits force prioritization, preserve all major pillars at some meaningful level

Free Drive

open world

realistic vehicle handling

multiple vehicle classes

Motorsport

racing AI

traffic

garagevehicle selection

mapnavigation

weathertime

settings

saveprogress

deployable browser build

The implementation may vary in depth, but it should not silently omit a major pillar without a technical reason.

Avoid common AI-generated-game failure modes

giant empty terrain

placeholder roads everywhere

identical vehicle handling

floaty physics

cars hovering above the road

excessive grip

twitchy steering

visually impressive menus with weak gameplay

dead UI buttons

fake features

traffic that constantly crashes

obvious asset repetition

severe pop-in

inconsistent scale

poor wheel orientation

unstable suspension

broken resetscheckpoints

debug UI left in production

systems that exist only as mockups

coming soon placeholders for core requested features

major TODO lists presented as if the game were complete

Kairos should remain runnable throughout development, but the run should continue until the requested game has been built as completely as practical.

27. Legaloriginality requirement

Kairos should use

original game branding

original car designs

original tracksworld

original fictional manufacturers if manufacturers are created

original liveries

Do not directly reproduce

real manufacturer logos

trademarked racing liveries

exact production-car geometry without appropriate licensing

copyrighted track branding

existing game UI verbatim

Real automotive engineering concepts may obviously be used.

28. Saveprogression direction

Potential browser-persisted state

settings

graphics preset

control mappings

selected vehicle

customization

discovered roadslocations

lap records

personal bests

progress

The first implementation does not need a giant progression economy.

Driving quality comes first.

29. Developerdebug tooling

The eventual development environment should expose useful telemetry such as

FPS

frame time

GPUrender statistics

physics rate

speed

gear

wheel slip

tire load

suspension travel

steering angle

tire temperature if modeled

AI state

streamed world-cell state

memoryasset statistics

Useful dev commands may include

reset car

teleport

change vehicle

change weather

change time

toggle traffic

reload scene

toggle debug rendering

This tooling should exist early because physics and performance tuning will depend on it.

30. What the visual mockups represent

The supplied mockups cover several intended experiences

Free Drive gameplay

third-person car view

scenic highway

golden-hour lighting

minimal navigationHUD

premium realistic atmosphere

Formula-style Motorsport gameplay

low chase camera

circuit environment

positionlaptiming HUD

race-focused telemetry

cinematic sunset lighting

Garage  vehicle selection

premium showroom

selected road car

GT and Formula cars visible

vehicle stats

clean menu hierarchy

Open-world map  event selection

large region map

city, mountains, lakes, highways

event categories

highlighted scenic routes

circuit events

polished AAA-style navigation

Codex should inspect the actual images rather than relying only on these descriptions.

31. What Codex should do next

Using this context plus every visual mockup present in the repository, Codex should first create a deep internal implementation plan, then immediately execute it as one continuous goal.

If the Codex environment supports goal mode, use it for this project so the agent keeps pursuing the end state rather than treating the first deliverable as completion.

The plan should be concrete enough to guide implementation without repeatedly redesigning the architecture. At minimum it should resolve

repository structure

build tooling

package management

TypeScript configuration

BabylonWebGPU initialization

WebGL2 fallback

render-loop strategy

fixed-step physics loop

interpolation between physicsrender frames

custom vehicle-physics architecture

tire model

suspension model

drivetrain model

assists

surfacematerial friction model

input abstraction

keyboard smoothing

controller support

camera system

vehicle data definitions

asset pipeline

GLBglTF conventions

mesh compression

texture compression

shadermaterial strategy

road representation

road-generationediting workflow

terrainenvironment strategy

world-cell representation

world streaming

LODHLOD strategy

vegetation instancing

traffic lane graph

traffic AI

racing line representation

racing AI

race-session state machine

timingsectorslaps

track limits

penalties

tirefuel systems

garage

car selection

customization

Free Drive activities

navigation

world map

UI architecture

audio architecture

weather

time of day

savesettings

debug telemetry

profiling tools

automated tests

smoke tests

browser compatibility tests

deployment

Vercelstatic hosting

asset hostingCDN fallback

cacheversioning strategy

service worker or offline caching only if useful and safe

performance budgets

memory budgets

draw-call budgets

AIphysics budgets

target hardware presets

graceful feature degradation

major technical risks and fallbacks

After producing the plan, do not wait for user approval unless a genuinely blocking decision requires credentials, paid infrastructure, inaccessible external assets, or another action only the user can perform.

Proceed to implementation.

31.1 Definition of done

Codex should not consider the goal complete merely because the application starts.

The strongest practical final state should include

Core runtime

loads from a normal HTTPS URL;

no native install;

no game streaming;

local browser rendering and simulation;

WebGPU preferred;

WebGL2 fallback where feasible;

clean startuploading flow;

no dependency on blocked third-party runtime CDNs.

Free Drive

a meaningful drivable open world;

multiple distinct regions;

streamed world cells;

highways and smaller roads;

traffic;

navigationmap;

optional activities;

multiple road vehicles;

daynight and weather at a useful level;

garagevehicle selection.

Driving model

believable suspension;

progressive tire grip;

weight transfer;

drivetrain behavior;

braking;

steering;

assists;

surface differences;

clear handling differences among road, GT, and Formula vehicles.

Motorsport

at least one complete professional-style circuit;

GT3-style car;

Formula-style car;

racing AI;

practice;

qualifying or equivalent timed session;

races;

gridsession management;

lapsector timing;

position tracking;

fueltire systems at a meaningful level;

results flow.

Presentation

chase camera;

cockpithood or equivalent secondary cameras;

Free Drive HUD;

Motorsport HUD;

main menu;

garage;

map;

settings;

responsive layout;

visual direction consistent with repository mockups.

Audio

engine response;

tire sounds;

impacts;

roadwind ambience;

basic environmental audio;

appropriate separation between vehicle classes.

Performance

graphics presets;

scalable trafficvegetation;

LODs;

world streaming;

compressed assets;

measured performance;

no catastrophic memory growth;

acceptable behavior on the secondary-laptop target class.

Persistence

settings saved;

selected vehicle saved;

meaningful progresspersonal records saved.

Deployment

production build created;

hosted build deployed when available toolscredentials permit;

deployed build smoke-tested;

obvious deployment-specific issues fixed.

31.2 Autonomy rules

Codex should make ordinary technical decisions itself.

Examples

choose sane package versions;

choose folder names;

design interfaces;

choose reasonable initial physics constants;

choose fictional manufacturermodel names;

create temporary original procedural assets when necessary;

choose initial road layouts;

tune graphics presets;

create debugging utilities;

refactor code when architecture becomes limiting.

Do not stop merely because the context does not specify a value that a competent game engineer could reasonably decide.

Ask the user only when the decision is truly external or irreversible, such as

needing credentials;

spending money;

publishing to an account without permission;

acquiring a licensed asset;

choosing between two materially different product directions that cannot be inferred from this context.

31.3 Build-test-fix loop

Throughout the entire goal, Codex should repeatedly

build;

run;

inspect consoleruntime errors;

test controls and game flow;

inspect visual output;

profile CPUGPUframe time;

validate physics behavior;

test world streaming;

test race flow;

test on the hosted build when applicable;

fix discovered issues;

retest;

continue to the next system.

Do not accumulate a large stack of known broken behavior for later.

31.4 Feature-completion behavior

When a requested system is difficult, do not silently skip it.

Use this hierarchy

full implementation
    ↓ if infeasible
strong simplified implementation
    ↓ if infeasible
credible substitute preserving the intended experience
    ↓
document exact limitation
    ↓
continue building the rest of Kairos

A browser limitation is a reason to redesign a feature, not a reason to abandon the overall goal.

31.5 Final handoff

At the end of the continuous goal, Codex should leave the repository in a state that another developer can immediately understand and continue.

Include

working source;

production build configuration;

deployment configuration;

README;

controls;

architecture notes;

asset attributionlicensing notes where relevant;

known limitations;

performance notes;

debug instructions;

how to run locally;

how to deploy;

major tuning parameters.

The final report should distinguish

what is fully implemented;

what is implemented in simplified form;

what could not be implemented and why;

measured performanceresults;

exact deployment URL if one was produced.

The report is the last step, not a substitute for implementation.



32. Maximum-capability stress-test directive

Kairos is intentionally not scoped like a normal small indie browser project.

The purpose of this project is to test how far a highly capable autonomous coding model can carry a difficult, multi-system game-development objective when given substantial autonomy.

Accordingly

be ambitious;

use the available context window and tools aggressively;

inspect the codebase rather than guessing;

generate supporting tools when useful;

automate repetitive assetdata work;

run the game frequently;

profile real bottlenecks;

refactor when necessary;

solve root causes rather than layering hacks;

continue after the first success;

continue after the first playable build;

continue after the first deployment;

use remaining effort to improve quality, breadth, stability, and polish.

The aim is not to prove that a browser can render a car.

The aim is to produce Kairos, a convincing browser-native driving game with an open world, realistic-feeling vehicles, Free Drive, and Motorsport, and to push the development agent as close as practical to the limits of its engineering capability in one sustained goal.

33. Final product definition

The eventual goal is

User opens Kairos in a normal browser
        ↓
Kairos loads from a normal HTTPS URL
        ↓
No native application is installed
        ↓
No game is streamed from another machine
        ↓
The local laptop runs rendering + physics + AI
        ↓
Player chooses Free