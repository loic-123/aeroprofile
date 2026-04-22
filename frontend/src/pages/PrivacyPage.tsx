import { useTranslation, Trans } from "react-i18next";
import { ArrowLeft } from "lucide-react";

interface Props {
  onGotoHome: () => void;
}

export default function PrivacyPage({ onGotoHome }: Props) {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-20">
      <button
        onClick={onGotoHome}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors mb-10"
      >
        <ArrowLeft size={12} aria-hidden />
        {t("privacy.back")}
      </button>

      <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-5">
        {t("privacy.eyebrow")}
      </div>
      <h1 className="font-display text-3xl md:text-4xl leading-[1.1] text-text tracking-tight mb-4">
        {t("privacy.title")}
      </h1>
      <p className="text-xs text-muted mb-10">
        {t("privacy.lastUpdate")}
      </p>

      <div className="prose prose-invert max-w-none space-y-6 text-[15px] leading-relaxed text-muted-strong">
        <section>
          <h2 className="font-display text-xl text-text mt-8 mb-3">{t("privacy.s1.title")}</h2>
          <p>{t("privacy.s1.body")}</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-text mt-8 mb-3">{t("privacy.s2.title")}</h2>
          <p>
            <Trans
              i18nKey="privacy.s2.body"
              components={{ strong: <strong className="text-text" /> }}
            />
          </p>
          <ul className="list-disc list-outside pl-6 space-y-2 mt-3">
            <li>{t("privacy.s2.item1")}</li>
            <li>{t("privacy.s2.item2")}</li>
            <li>{t("privacy.s2.item3")}</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl text-text mt-8 mb-3">{t("privacy.s3.title")}</h2>
          <p>{t("privacy.s3.body")}</p>
          <ul className="list-disc list-outside pl-6 space-y-2 mt-3">
            <li>{t("privacy.s3.item1")}</li>
            <li>{t("privacy.s3.item2")}</li>
            <li>{t("privacy.s3.item3")}</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl text-text mt-8 mb-3">{t("privacy.s4.title")}</h2>
          <p>
            <Trans
              i18nKey="privacy.s4.body"
              components={{
                openmeteo: (
                  <a
                    href="https://open-meteo.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Open-Meteo
                  </a>
                ),
                intervals: (
                  <a
                    href="https://intervals.icu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Intervals.icu
                  </a>
                ),
              }}
            />
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-text mt-8 mb-3">{t("privacy.s5.title")}</h2>
          <p>{t("privacy.s5.body")}</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-text mt-8 mb-3">{t("privacy.s6.title")}</h2>
          <p>{t("privacy.s6.body")}</p>
          <ul className="list-disc list-outside pl-6 space-y-2 mt-3">
            <li>{t("privacy.s6.item1")}</li>
            <li>{t("privacy.s6.item2")}</li>
            <li>{t("privacy.s6.item3")}</li>
            <li>{t("privacy.s6.item4")}</li>
          </ul>
          <p className="mt-3">
            <Trans
              i18nKey="privacy.s6.contact"
              components={{
                mail: (
                  <a
                    href="mailto:loic.bouxirot@gmail.com"
                    className="text-primary hover:underline"
                  >
                    loic.bouxirot@gmail.com
                  </a>
                ),
              }}
            />
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-text mt-8 mb-3">{t("privacy.s7.title")}</h2>
          <p>{t("privacy.s7.body")}</p>
        </section>
      </div>
    </div>
  );
}
