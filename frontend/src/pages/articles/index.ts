import PowerEquation from "./power-equation";
import CdaWhatIsIt from "./cda-what-is-it";
import CdaWhatIsItEn from "./cda-what-is-it.en";
import WindCorrection from "./wind-correction";
import Solvers from "./solvers";
import Filters from "./filters";
import YawAngle from "./yaw-angle";
import BayesianPriors from "./bayesian-priors";
import AggregationMethods from "./aggregation-methods";
import DraftingDetection from "./drafting-detection";
import IterativeRefinement from "./iterative-refinement";
import WCdaMetric from "./w-cda-metric";
import IntervalsIntegration from "./intervals-integration";
import PowerMeterQuality from "./power-meter-quality";
import PriorInvariance from "./prior-invariance";
import i18n from "../../i18n";

/**
 * Picks the EN variant of an article if the current language is English and
 * an .en.tsx translation exists, otherwise falls back to the original FR
 * article. Keeps the registry one-line-per-article for the 13 FR-only
 * articles while letting us progressively add EN companions.
 */
function localized(fr: () => JSX.Element, en?: () => JSX.Element) {
  return () => {
    const lang = i18n.language?.startsWith("en") ? "en" : "fr";
    if (lang === "en" && en) return en();
    return fr();
  };
}

export const ARTICLES: Record<string, () => JSX.Element> = {
  "power-equation": PowerEquation,
  "cda-what-is-it": localized(CdaWhatIsIt, CdaWhatIsItEn),
  "wind-correction": WindCorrection,
  "solvers": Solvers,
  "filters": Filters,
  "yaw-angle": YawAngle,
  "bayesian-priors": BayesianPriors,
  "aggregation-methods": AggregationMethods,
  "drafting-detection": DraftingDetection,
  "iterative-refinement": IterativeRefinement,
  "w-cda-metric": WCdaMetric,
  "intervals-integration": IntervalsIntegration,
  "power-meter-quality": PowerMeterQuality,
  "prior-invariance": PriorInvariance,
};
