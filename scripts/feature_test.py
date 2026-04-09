"""Systematic feature analysis: test which features make CdA most consistent."""
import asyncio, sys
import numpy as np

rides = [
    ('2h_Endurance',    '/tmp/loic_rides/i75207145_2h_Endurance.fit'),
    ('Endurance_3h_a',  '/tmp/loic_rides/i72368951_Endurance_3h.fit'),
    ('Endurance_3h_b',  '/tmp/loic_rides/i82355365_Endurance_3h.fit'),
    ('2h_SST',          '/tmp/loic_rides/i83852458_2h_SST.fit'),
    ('2h30_SV1',        '/tmp/loic_rides/i89935518_2h30_SV1.fit'),
    ('3h30_endurance',  '/tmp/loic_rides/i91434480_3h30_endurance.fit'),
    ('2h30_endurance',  '/tmp/loic_rides/i91907554_2h30_endurance.fit'),
    ('4h_endurance',    '/tmp/loic_rides/i95152070_4h_endurance.fit'),
]
MASS = 76

# Previous results (with weather, already computed)
prev_results = {
    '1_BASELINE':       0.030,
    '2_no_weather':     0.029,
    '3_crr_fixed_0033': 0.023,
    '4_drop_descents':  0.030,
    '5_block_60s':      0.025,
    '6_no_tiles':       0.031,
    '7_no_yaw':         0.030,
}

from aeroprofile.pipeline import analyze as _analyze
import aeroprofile.pipeline as _pipe


async def run_config(label, **kwargs):
    cdas = []
    details = []
    for name, path in rides:
        try:
            r = await _analyze(path, mass_kg=MASS, **kwargs)
            cdas.append(r.cda)
            nrmse = r.rmse_w / max(r.avg_power_w, 1)
            details.append(
                f'  {name:20s} CdA={r.cda:.3f} Crr={r.crr:.4f} '
                f'R2={r.r_squared:.3f} nRMSE={nrmse:.2f} method={r.solver_method}'
            )
        except Exception as e:
            details.append(f'  {name:20s} ERROR: {e}')
    if len(cdas) >= 2:
        mean_c = np.mean(cdas)
        std_c = np.std(cdas)
        spread = max(cdas) - min(cdas)
        print(f'=== {label} ===')
        print(f'  CdA: mean={mean_c:.3f}  std={std_c:.3f}  spread={spread:.3f}  [{min(cdas):.3f} - {max(cdas):.3f}]')
        for d in details:
            print(d)
        print()
        sys.stdout.flush()
        return std_c
    return 999.0


async def main():
    results = dict(prev_results)
    print('Remaining configs (fetch_wx=False for speed — wind-inverse estimates wind from data)')
    print('=' * 90)
    print()
    sys.stdout.flush()

    # 8. No variable eta
    import importlib
    _pm = importlib.import_module('aeroprofile.physics.power_model')
    _orig_ev = _pm.eta_variable
    _pm.eta_variable = lambda P: np.full_like(np.asarray(P, dtype=float), 0.977)
    s = await run_config('8. NO VARIABLE ETA', fetch_wx=False, bike_type='road')
    _pm.eta_variable = _orig_ev
    results['8_no_var_eta'] = s

    # 9. No CdA prior
    from aeroprofile.bike_types import BIKE_TYPES, BikeTypeConfig
    _orig_road = BIKE_TYPES['road']
    BIKE_TYPES['road'] = BikeTypeConfig(
        label='Route', cda_prior_mean=0.30, cda_prior_sigma=999.0,
        cda_lower=0.15, cda_upper=0.60,
    )
    s = await run_config('9. NO CDA PRIOR (sigma=999)', fetch_wx=False, bike_type='road')
    BIKE_TYPES['road'] = _orig_road
    results['9_no_cda_prior'] = s

    # 10. Tight CdA prior (sigma=0.04)
    BIKE_TYPES['road'] = BikeTypeConfig(
        label='Route', cda_prior_mean=0.32, cda_prior_sigma=0.04,
        cda_lower=0.25, cda_upper=0.45,
    )
    s = await run_config('10. TIGHT CDA PRIOR (0.32 +/- 0.04, bounds [0.25-0.45])',
                         fetch_wx=False, bike_type='road')
    BIKE_TYPES['road'] = _orig_road
    results['10_tight_cda_prior'] = s

    # 11. No wind-inverse (Martin LS / Chung VE only)
    import aeroprofile.solver.wind_inverse as _wi
    _orig_sww = _wi.solve_with_wind
    _wi.solve_with_wind = lambda *a, **kw: None
    _pipe.solve_with_wind = _wi.solve_with_wind
    s = await run_config('11. NO WIND-INVERSE (Martin LS / Chung only)',
                         fetch_wx=False, bike_type='road')
    _wi.solve_with_wind = _orig_sww
    _pipe.solve_with_wind = _orig_sww
    results['11_no_wind_inverse'] = s

    # 12. Combo: Crr fixed + block 60s (no weather)
    s = await run_config('12. COMBO: Crr=0.0033 + Block 60s',
                         fetch_wx=False, bike_type='road',
                         crr_fixed=0.0033, min_block_seconds=60)
    results['12_combo_crr_b60'] = s

    # 13. Combo: Crr fixed + tight prior (no weather)
    BIKE_TYPES['road'] = BikeTypeConfig(
        label='Route', cda_prior_mean=0.32, cda_prior_sigma=0.04,
        cda_lower=0.25, cda_upper=0.45,
    )
    s = await run_config('13. COMBO: Crr=0.0033 + TightPrior',
                         fetch_wx=False, bike_type='road', crr_fixed=0.0033)
    BIKE_TYPES['road'] = _orig_road
    results['13_combo_crr_tightprior'] = s

    # 14. Combo: Crr fixed + block 60s + tight prior
    BIKE_TYPES['road'] = BikeTypeConfig(
        label='Route', cda_prior_mean=0.32, cda_prior_sigma=0.04,
        cda_lower=0.25, cda_upper=0.45,
    )
    s = await run_config('14. COMBO: Crr=0.0033 + Block60 + TightPrior',
                         fetch_wx=False, bike_type='road',
                         crr_fixed=0.0033, min_block_seconds=60)
    BIKE_TYPES['road'] = _orig_road
    results['14_combo_all'] = s

    # 15. Just Crr fixed (no weather)
    s = await run_config('15. Crr=0.0033 only (no weather)',
                         fetch_wx=False, bike_type='road', crr_fixed=0.0033)
    results['15_crr_no_wx'] = s

    print('=' * 90)
    print()
    print('FINAL RANKING by CdA std (lower = more consistent):')
    print('-' * 65)
    for k, v in sorted(results.items(), key=lambda x: x[1]):
        bar = '#' * int(v * 500)
        print(f'  std={v:.4f}  {k:45s} {bar}')
    print()
    sys.stdout.flush()


asyncio.run(main())
