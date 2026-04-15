import PowerEquation from "./power-equation";
import CdaWhatIsIt from "./cda-what-is-it";
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

export const ARTICLES: Record<string, () => JSX.Element> = {
  "power-equation": PowerEquation,
  "cda-what-is-it": CdaWhatIsIt,
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
