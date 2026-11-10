extends GutTest
## A tick fills only missing populations, shares attempts between kinds, and charges the
## spawn budget only for successful additions. Riot peds share one population with rioters.

const CATEGORIES: Array[int] = [
	CitySpawnPlan.RIOTERS,
	CitySpawnPlan.COPS,
	CitySpawnPlan.POLICE_CARS,
	CitySpawnPlan.CARS,
	CitySpawnPlan.PEDS,
]
const COUNTER_SLOTS: Array[int] = [
	SimConst.CN_PEDS, SimConst.CN_COPS, SimConst.CN_PCARS, SimConst.CN_CARS, SimConst.CN_PEDS
]


func test_no_requested_population_finishes_without_spawning() -> void:
	var plan: CitySpawnPlan = CitySpawnPlan.new(CityTargets.new(), _counters())
	assert_eq(plan.next(), -1, "an empty plan has no turn, even with no live actors")
	assert_eq(plan.next(), -1, "completion is stable")
	assert_eq(plan.made, 0)


func test_each_category_fills_its_own_deficit_and_stops_at_the_target() -> void:
	for i: int in CATEGORIES.size():
		var cat: int = CATEGORIES[i]
		var counters: PackedInt32Array = _counters()
		counters.fill(19)
		counters[COUNTER_SLOTS[i]] = 2
		var plan: CitySpawnPlan = CitySpawnPlan.new(_target(cat, 4), counters)
		assert_eq(plan.made, 0, "existing actors do not consume this tick's budget")
		assert_eq(plan.next(), cat, "only the requested kind needs actors")
		plan.add(cat)
		assert_eq(plan.made, 1)
		assert_eq(plan.next(), cat, "one actor below target still needs a spawn")
		plan.add(cat)
		assert_eq(plan.made, 2)
		assert_eq(plan.next(), -1, "equality is full: no extra actor may be requested")


func test_existing_population_at_or_above_target_needs_no_spawn() -> void:
	for i: int in CATEGORIES.size():
		for population: int in [3, 4]:
			var counters: PackedInt32Array = _counters()
			counters[COUNTER_SLOTS[i]] = population
			var plan: CitySpawnPlan = CitySpawnPlan.new(_target(CATEGORIES[i], 3), counters)
			assert_eq(plan.next(), -1, "a full or surplus population needs no refill")
			assert_eq(plan.made, 0)


func test_street_categories_take_turns_even_when_spawn_attempts_fail() -> void:
	var targets: CityTargets = CityTargets.street(1, 1, 1)
	targets.cops = 1
	var plan: CitySpawnPlan = CitySpawnPlan.new(targets, _counters())
	var order: Array[int] = [
		CitySpawnPlan.COPS, CitySpawnPlan.POLICE_CARS, CitySpawnPlan.CARS, CitySpawnPlan.PEDS
	]
	for cycle: int in 3:
		for cat: int in order:
			assert_eq(plan.next(), cat, "a failed attempt yields to the next kind")
	assert_eq(plan.made, 0, "asking for a turn never charges the successful-spawn budget")
	for cat: int in order:
		assert_eq(plan.next(), cat, "failed attempts leave the original deficit intact")
		plan.add(cat)
	assert_eq(plan.next(), -1)
	assert_eq(plan.made, order.size())


func test_zero_ped_quota_does_not_disrupt_turns_for_requested_kinds() -> void:
	var targets: CityTargets = CityTargets.street(0, 2, 2)
	targets.cops = 2
	var plan: CitySpawnPlan = CitySpawnPlan.new(targets, _counters())
	var order: Array[int] = [CitySpawnPlan.COPS, CitySpawnPlan.POLICE_CARS, CitySpawnPlan.CARS]
	for cycle: int in 3:
		for cat: int in order:
			assert_eq(plan.next(), cat, "an unrequested kind must not disturb the rotation")
	assert_eq(plan.made, 0, "failed attempts still leave the entire spawn budget available")


func test_full_categories_are_skipped_without_starving_remaining_kinds() -> void:
	var targets: CityTargets = CityTargets.street(2, 1, 1)
	targets.cops = 2
	var counters: PackedInt32Array = _counters()
	counters[SimConst.CN_PCARS] = 1
	counters[SimConst.CN_CARS] = 2
	var plan: CitySpawnPlan = CitySpawnPlan.new(targets, counters)
	var seen: Array[int] = []
	for attempt: int in 8:
		var cat: int = plan.next()
		assert_true(cat == CitySpawnPlan.COPS or cat == CitySpawnPlan.PEDS)
		seen.append(cat)
	assert_has(seen, CitySpawnPlan.COPS, "full vehicle kinds cannot block cops")
	assert_has(seen, CitySpawnPlan.PEDS, "full vehicle kinds cannot block pedestrians")
	var added: Array[int] = []
	for attempt: int in 4:
		var cat: int = plan.next()
		if cat != CitySpawnPlan.COPS and cat != CitySpawnPlan.PEDS:
			fail_test("unfinished populations must keep receiving turns")
			return
		added.append(cat)
		plan.add(cat)
	assert_eq(added.count(CitySpawnPlan.COPS), 2)
	assert_eq(added.count(CitySpawnPlan.PEDS), 2)
	assert_eq(plan.made, 4)
	assert_eq(plan.next(), -1, "adding one kind must not fill another kind's deficit")


func test_riot_peds_count_as_rioters_and_do_not_get_a_second_ped_quota() -> void:
	var targets: CityTargets = CityTargets.riot(3, 1)
	targets.peds = 20
	targets.police_cars = 1
	targets.cars = 1
	var counters: PackedInt32Array = _counters()
	counters[SimConst.CN_PEDS] = 2
	var plan: CitySpawnPlan = CitySpawnPlan.new(targets, counters)
	var order: Array[int] = [
		CitySpawnPlan.RIOTERS, CitySpawnPlan.COPS, CitySpawnPlan.POLICE_CARS, CitySpawnPlan.CARS
	]
	for cat: int in order:
		assert_eq(plan.next(), cat)
		plan.add(cat)
	assert_eq(plan.made, order.size())
	assert_eq(plan.next(), -1, "riot actors fill the ped population without a separate ped turn")


func _counters() -> PackedInt32Array:
	var counters: PackedInt32Array = PackedInt32Array()
	@warning_ignore("return_value_discarded")
	counters.resize(SimConst.CN_COUNT)
	counters.fill(0)
	return counters


func _target(cat: int, count: int) -> CityTargets:
	var targets: CityTargets = CityTargets.new()
	match cat:
		CitySpawnPlan.RIOTERS:
			targets.rioters = count
		CitySpawnPlan.COPS:
			targets.cops = count
		CitySpawnPlan.POLICE_CARS:
			targets.police_cars = count
		CitySpawnPlan.CARS:
			targets.cars = count
		CitySpawnPlan.PEDS:
			targets.peds = count
	return targets
