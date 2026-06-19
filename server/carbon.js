// Live carbon-emission model.
//
// We can't read real fuel flow from public feeds, so we estimate using a
// transparent, distance-based model:
//
//   instantaneous rate (kg CO2 / s) for a vehicle
//     = factor(kg CO2 / km) * speed(km/h) / 3600
//
// Summing across every airborne flight and every moving ship gives a live
// global emission rate. Integrating that rate over time gives a running
// total accumulated since the server started.
import { config } from './config.js';

export function flightRateKgPerSec(speedKmh) {
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) return 0;
  return (config.carbon.flightKgPerKm * speedKmh) / 3600;
}

export function shipRateKgPerSec(speedKmh) {
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) return 0;
  return (config.carbon.shipKgPerKm * speedKmh) / 3600;
}

// Aggregate instantaneous emission rates for the current fleets.
export function aggregateRates(flights, ships) {
  let flightKgPerSec = 0;
  for (const f of flights) flightKgPerSec += flightRateKgPerSec(f.speedKmh);

  let shipKgPerSec = 0;
  for (const s of ships) shipKgPerSec += shipRateKgPerSec(s.speedKmh);

  return {
    flightKgPerSec,
    shipKgPerSec,
    totalKgPerSec: flightKgPerSec + shipKgPerSec,
    flightCount: flights.length,
    shipCount: ships.length,
  };
}

// Deterministic, stateless carbon snapshot for serverless / on-demand use.
// Integrates the current instantaneous rate from the start of the current
// UTC day to "now". Because it depends only on the live fleet and the clock
// (not on accumulated process state), it returns a consistent, steadily
// growing figure across stateless function invocations.
export function computeCarbon(flights, ships) {
  const rates = aggregateRates(flights, ships);
  const now = Date.now();
  const dayStartMs = Math.floor(now / 86_400_000) * 86_400_000; // midnight UTC
  const elapsedS = (now - dayStartMs) / 1000;
  return {
    sinceStartKg: rates.totalKgPerSec * elapsedS,
    flightKg: rates.flightKgPerSec * elapsedS,
    shipKg: rates.shipKgPerSec * elapsedS,
    rates,
    ts: now,
  };
}

// Stateful accumulator that integrates the global rate over wall-clock time.
export class CarbonAccumulator {
  constructor() {
    this.totalKg = 0;
    this.flightKg = 0;
    this.shipKg = 0;
    this.lastTs = Date.now();
    this.lastRates = {
      flightKgPerSec: 0,
      shipKgPerSec: 0,
      totalKgPerSec: 0,
      flightCount: 0,
      shipCount: 0,
    };
  }

  update(flights, ships) {
    const now = Date.now();
    const dt = (now - this.lastTs) / 1000;
    this.lastTs = now;

    const rates = aggregateRates(flights, ships);
    // Integrate using the rate measured at the start of the interval.
    this.flightKg += this.lastRates.flightKgPerSec * dt;
    this.shipKg += this.lastRates.shipKgPerSec * dt;
    this.totalKg = this.flightKg + this.shipKg;
    this.lastRates = rates;
    return this.snapshot();
  }

  snapshot() {
    return {
      sinceStartKg: this.totalKg,
      flightKg: this.flightKg,
      shipKg: this.shipKg,
      rates: this.lastRates,
      ts: this.lastTs,
    };
  }
}
