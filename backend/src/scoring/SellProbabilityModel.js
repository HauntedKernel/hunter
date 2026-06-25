/**
 * SellProbabilityModel — loads the trained logistic model (sell_model.json, from
 * scripts/train_sell_model.js) and turns a property's signals into a CALIBRATED
 * probability that the owner sells within the model window, plus a per-feature
 * contribution breakdown (the "why"). This is the analytics moat (STRATEGY.md §0):
 * a probability a filter tool can't give, with an explanation.
 *
 * Loads lazily/defensively — if the model file is missing the model is simply
 * `available = false` and the scorer falls back to its weighted score.
 */
const fs = require('fs');
const path = require('path');

// Human labels for the model's raw feature names (for the "why").
const LABELS = {
  delinq: 'Tax delinquent',
  absentee: 'Absentee owner',
  elderly: 'Elderly owner (over-65)',
  suit: 'Tax-foreclosure suit pending',
  estate: 'Estate / inherited',
  dyears: 'Years delinquent',
  logdue: 'Amount owed',
  logval: 'Property value',
  absentee_x_elderly: 'Absentee + elderly',
  delinq_x_suit: 'Delinquent + suit'
};

class SellProbabilityModel {
  constructor(modelPath = path.join(__dirname, 'sell_model.json')) {
    this.available = false;
    try {
      const m = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
      this.features = m.features;
      this.weights = m.weights;
      this.bias = m.bias;
      this.baseRate = m.baseRate;
      this.auc = m.auc;
      // standardize: { cols:[names], mean:[], std:[] } in matching order
      this.stdByName = {};
      (m.standardize?.cols || []).forEach((c, i) => {
        this.stdByName[c] = { mean: m.standardize.mean[i], std: m.standardize.std[i] || 1 };
      });
      this.available = Array.isArray(this.weights) && Array.isArray(this.features);
    } catch (_) {
      this.available = false;
    }
  }

  /**
   * @param {Object} f raw feature inputs:
   *   { delinq, absentee, elderly, suit, estate, dyears, totalAmountDue, totalValue }
   * @returns {{probability, lift, contributions, drivers}|null}
   */
  score(f) {
    if (!this.available) return null;
    const b = (v) => (v ? 1 : 0);
    const delinq = b(f.delinq), absentee = b(f.absentee), elderly = b(f.elderly),
      suit = b(f.suit), estate = b(f.estate);
    const raw = {
      delinq, absentee, elderly, suit, estate,
      dyears: f.dyears || 0,
      logdue: Math.log((f.totalAmountDue || 0) + 1),
      logval: Math.log((f.totalValue || 0) + 1),
      absentee_x_elderly: absentee * elderly,
      delinq_x_suit: delinq * suit
    };

    let logit = this.bias;
    const contributions = [];
    for (let i = 0; i < this.features.length; i++) {
      const name = this.features[i];
      let x = raw[name];
      const s = this.stdByName[name];
      if (s) x = (x - s.mean) / s.std;        // standardize continuous to match training
      const contrib = this.weights[i] * x;     // log-odds contribution
      logit += contrib;
      contributions.push({ feature: name, label: LABELS[name] || name, contribution: contrib });
    }
    const probability = 1 / (1 + Math.exp(-logit));

    // "Drivers" = the features pushing this owner ABOVE the base rate (positive
    // log-odds contribution), most influential first.
    const drivers = contributions
      .filter(c => c.contribution > 0.01)
      .sort((a, b2) => b2.contribution - a.contribution)
      .slice(0, 4)
      .map(c => c.label);

    return {
      probability,
      lift: this.baseRate ? probability / this.baseRate : null,
      contributions,
      drivers
    };
  }
}

module.exports = SellProbabilityModel;
