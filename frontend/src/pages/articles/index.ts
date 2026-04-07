import PowerEquation from "./power-equation";
import CdaWhatIsIt from "./cda-what-is-it";
import WindCorrection from "./wind-correction";
import Solvers from "./solvers";
import Filters from "./filters";
import YawAngle from "./yaw-angle";
import BayesianPriors from "./bayesian-priors";
import DraftingDetection from "./drafting-detection";

export const ARTICLES: Record<string, () => JSX.Element> = {
  "power-equation": PowerEquation,
  "cda-what-is-it": CdaWhatIsIt,
  "wind-correction": WindCorrection,
  "solvers": Solvers,
  "filters": Filters,
  "yaw-angle": YawAngle,
  "bayesian-priors": BayesianPriors,
  "drafting-detection": DraftingDetection,
};
