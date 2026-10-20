import * as migration_20261020_170531_initial from './20261020_170531_initial';

export const migrations = [
  {
    up: migration_20261020_170531_initial.up,
    down: migration_20261020_170531_initial.down,
    name: '20261020_170531_initial'
  },
];
