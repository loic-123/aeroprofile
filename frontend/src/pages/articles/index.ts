import PowerEquation from "./power-equation";
import PowerEquationEn from "./power-equation.en";
import CdaWhatIsIt from "./cda-what-is-it";
import CdaWhatIsItEn from "./cda-what-is-it.en";
import WindCorrection from "./wind-correction";
import WindCorrectionEn from "./wind-correction.en";
import Solvers from "./solvers";
import SolversEn from "./solvers.en";
import Filters from "./filters";
import FiltersEn from "./filters.en";
import YawAngle from "./yaw-angle";
import YawAngleEn from "./yaw-angle.en";
import BayesianPriors from "./bayesian-priors";
import BayesianPriorsEn from "./bayesian-priors.en";
import AggregationMethods from "./aggregation-methods";
import AggregationMethodsEn from "./aggregation-methods.en";
import DraftingDetection from "./drafting-detection";
import DraftingDetectionEn from "./drafting-detection.en";
import IterativeRefinement from "./iterative-refinement";
import IterativeRefinementEn from "./iterative-refinement.en";
import WCdaMetric from "./w-cda-metric";
import WCdaMetricEn from "./w-cda-metric.en";
import IntervalsIntegration from "./intervals-integration";
import IntervalsIntegrationEn from "./intervals-integration.en";
import PowerMeterQuality from "./power-meter-quality";
import PowerMeterQualityEn from "./power-meter-quality.en";
import PriorInvariance from "./prior-invariance";
import PriorInvarianceEn from "./prior-invariance.en";
import i18n from "../../i18n";

/**
 * Picks the EN variant of an article if the current language is English and
 * an .en.tsx translation exists, otherwise falls back to the original FR
 * article.
 */
function localized(fr: () => JSX.Element, en?: () => JSX.Element) {
  return () => {
    const lang = i18n.language?.startsWith("en") ? "en" : "fr";
    if (lang === "en" && en) return en();
    return fr();
  };
}

export const ARTICLES: Record<string, () => JSX.Element> = {
  "power-equation": localized(PowerEquation, PowerEquationEn),
  "cda-what-is-it": localized(CdaWhatIsIt, CdaWhatIsItEn),
  "wind-correction": localized(WindCorrection, WindCorrectionEn),
  "solvers": localized(Solvers, SolversEn),
  "filters": localized(Filters, FiltersEn),
  "yaw-angle": localized(YawAngle, YawAngleEn),
  "bayesian-priors": localized(BayesianPriors, BayesianPriorsEn),
  "aggregation-methods": localized(AggregationMethods, AggregationMethodsEn),
  "drafting-detection": localized(DraftingDetection, DraftingDetectionEn),
  "iterative-refinement": localized(IterativeRefinement, IterativeRefinementEn),
  "w-cda-metric": localized(WCdaMetric, WCdaMetricEn),
  "intervals-integration": localized(IntervalsIntegration, IntervalsIntegrationEn),
  "power-meter-quality": localized(PowerMeterQuality, PowerMeterQualityEn),
  "prior-invariance": localized(PriorInvariance, PriorInvarianceEn),
};
