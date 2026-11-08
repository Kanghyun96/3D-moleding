# TrackVision Agent Engineering Rules

See [AGENTS.md](./AGENTS.md) for the full specification.

When adding or updating equipment 3D models in this project:
1. **Always assign a unique parking slot** (`P01`~`P07`) and slot route (`home_{slotId}`) to prevent overlapping or teleportation.
2. **Prevent hovering/floating feel**: Set grounded offset, and always attach a contact ambient occlusion shadow plane (`y = 0.003`) beneath tracks/wheels. Never add ugly protruding boxes.
3. **Realistic rolling wheel & crawler motion**: Ultra-thin track shoe belt continuous circulation + rotating sprockets/idlers/rollers with $\theta = \text{dist} / R$ + independent pivot turns.
4. **Suspension & inertia**: Acceleration squat, braking dive, steering centrifugal roll, diesel engine idle tremor, and equipment-width-matched track marks.
5. **Concurrent driving**: Support independent simultaneous driving in `simulation.js`.
6. **Workspace sync**: Keep `C:\Users\김강현\Downloads\3D-moleding-main` and `F:\Workspace\3D-moleding-main` synchronized, and ensure `verify.js` and `test-concurrent-driving.mjs` pass 100%.
