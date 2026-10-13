"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { AiNowSectionFrame } from "./AiNowSectionFrame";
import { AiNowImage } from "./AiNowImage";
import { AiNowDisclosure } from "./AiNowDisclosure";
import {
  AIAUDIT_MODEL_PROOF_SOURCE_TONES,
  getAiAuditModelProofCopy,
  aiAuditModelProofTrustItemClassName,
  type AiAuditModelProofProviderKey,
} from "./aiaudit-model-proof-copy";

type RadarModel = {
  readonly name: string;
  readonly lab: string;
};

type RadarResponse = {
  readonly models?: readonly RadarModel[];
};

type Provider = {
  readonly lab: string;
  readonly mark: string | null;
  readonly wordmark: string;
  readonly tone: (typeof AIAUDIT_MODEL_PROOF_SOURCE_TONES)[AiAuditModelProofProviderKey];
};

const providers: readonly Provider[] = [
  { lab: "Workflow", mark: null, wordmark: "Workflow", tone: AIAUDIT_MODEL_PROOF_SOURCE_TONES.Workflow },
  { lab: "Bottleneck", mark: null, wordmark: "Bottleneck", tone: AIAUDIT_MODEL_PROOF_SOURCE_TONES.Bottleneck },
  { lab: "Evidence", mark: null, wordmark: "Evidence", tone: AIAUDIT_MODEL_PROOF_SOURCE_TONES.Evidence },
  { lab: "Owner", mark: null, wordmark: "Owner", tone: AIAUDIT_MODEL_PROOF_SOURCE_TONES.Owner },
  { lab: "Boundary", mark: null, wordmark: "Boundary", tone: AIAUDIT_MODEL_PROOF_SOURCE_TONES.Boundary },
  { lab: "Fit", mark: null, wordmark: "Fit", tone: AIAUDIT_MODEL_PROOF_SOURCE_TONES.Fit },
  { lab: "Pilot", mark: null, wordmark: "Pilot", tone: AIAUDIT_MODEL_PROOF_SOURCE_TONES.Pilot },
  { lab: "Measure", mark: null, wordmark: "Measure", tone: AIAUDIT_MODEL_PROOF_SOURCE_TONES.Measure },
  { lab: "Review", mark: null, wordmark: "Review", tone: AIAUDIT_MODEL_PROOF_SOURCE_TONES.Review },
  { lab: "Decision", mark: null, wordmark: "Decision", tone: AIAUDIT_MODEL_PROOF_SOURCE_TONES.Decision },
  { lab: "Not now", mark: null, wordmark: "Not now", tone: AIAUDIT_MODEL_PROOF_SOURCE_TONES["Not now"] },
];

export function AiNowModelProof() {
  const locale = useLocale();
  const copy = getAiAuditModelProofCopy(locale);
  const initialModels = useMemo<readonly RadarModel[]>(() => [
    { lab: "Workflow", name: copy.initialModels.Workflow },
    { lab: "Bottleneck", name: copy.initialModels.Bottleneck },
    { lab: "Evidence", name: copy.initialModels.Evidence },
    { lab: "Owner", name: copy.initialModels.Owner },
  ], [copy]);
  const [models, setModels] = useState<readonly RadarModel[]>(initialModels);

  useEffect(() => {
    let mounted = true;

    void fetch("/ai/models.json", { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<RadarResponse>;
      })
      .then((payload) => {
        if (mounted && payload?.models?.length) setModels(payload.models);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  const modelNames = useMemo(() => {
    const names = new Map(models.map((model) => [model.lab, model.name]));
    return (provider: Provider) => names.get(provider.lab)
      ?? copy.initialModels[provider.lab as keyof typeof copy.initialModels]
      ?? copy.providerLabels[provider.lab as AiAuditModelProofProviderKey]
      ?? provider.wordmark;
  }, [copy, models]);

  const renderProvider = (provider: Provider) => {
    const providerLabel = copy.providerLabels[provider.lab as AiAuditModelProofProviderKey] ?? provider.wordmark;
    return (
    <div className={`ainow-model-stage__provider ainow-model-stage__provider--${provider.tone}`} key={provider.lab} title={`${providerLabel}: ${modelNames(provider)}`}>
      <span className="ainow-model-stage__provider-mark" aria-hidden="true">
        {provider.mark ? (
          <AiNowImage
            src={provider.mark}
            alt=""
            width={18}
            height={18}
            frameClassName="inline-flex size-[18px]"
            className="size-full object-contain"
            unoptimized
          />
        ) : (
          <span className="ainow-model-stage__wordmark">{providerLabel.slice(0, 1)}</span>
        )}
      </span>
      <span className="ainow-model-stage__provider-copy">
        <span className="ainow-model-stage__provider-lab">{providerLabel}</span>
        <span className="ainow-model-stage__provider-model">{modelNames(provider)}</span>
      </span>
    </div>
    );
  };

  return (
    <AiNowSectionFrame
      id="model-architecture"
      hasLaser={false}
      showTicks={false}
      containerClassName="px-4 sm:px-6 lg:px-8 py-10 sm:py-16"
    >
      <section className="ainow-model-stage" aria-labelledby="ainow-model-stage-title">
        <div className="ainow-model-stage__intro">
          <div className="ainow-model-stage__eyebrow">
            <span className="ainow-model-stage__status" aria-hidden="true" />
            <span>{copy.eyebrow}</span>
          </div>
          <h2 id="ainow-model-stage-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>

        <div
          className="ainow-model-stage__decision ainow-model-stage__visual-card"
        >
          <AiNowImage
            className="ainow-model-stage__decision-image"
            src="/graphics-3d/products/aiaudit-handover-v1.png"
            alt=""
            fill
            frameClassName="absolute inset-0"
            sizes="(max-width: 767px) 100vw, 40vw"
          />
          <div className="ainow-model-stage__decision-scrim" aria-hidden="true" />
          <div className="ainow-model-stage__decision-content">
            <div className="ainow-model-stage__decision-copy">
              <span>{copy.jevKicker}</span>
              <strong>{copy.jevTitle}</strong>
              <p>{copy.jevDescription}</p>
            </div>
          </div>
        </div>

        <div
          className="ainow-model-stage__catalog ainow-model-stage__visual-card"
          aria-label={copy.radar}
        >
          <AiNowImage
            className="ainow-model-stage__catalog-image"
            src="/graphics-3d/products/aiaudit-recommendation-v1.png"
            alt=""
            fill
            frameClassName="absolute inset-0"
            sizes="(max-width: 767px) 100vw, 58vw"
          />
          <div className="ainow-model-stage__catalog-scrim" aria-hidden="true" />
          <div className="ainow-model-stage__catalog-content">
            <div className="ainow-model-stage__catalog-heading">
              <span>{copy.radar}</span>
            </div>
            <div className="ainow-model-stage__providers" data-model-provider-group="primary">
              {providers.slice(0, 4).map(renderProvider)}
            </div>
            <AiNowDisclosure
              title={copy.moreTechnologies}
              className="mt-2 border-t border-slate-200/60 [&>button]:min-h-10 [&>button]:py-2 [&>button]:text-xs dark:border-white/10"
            >
              <div className="ainow-model-stage__providers pb-1" data-model-provider-group="additional">
                {providers.slice(4).map(renderProvider)}
              </div>
            </AiNowDisclosure>
          </div>
        </div>

        <dl className="ainow-model-stage__trust" aria-label={copy.trustLabel} tabIndex={0}>
          {copy.trust.map((item, index) => (
            <div className={aiAuditModelProofTrustItemClassName(index)} key={item.value}>
              <AiNowImage
                className="ainow-model-stage__trust-image"
                src={item.image}
                alt=""
                fill
                frameClassName="absolute inset-0"
                sizes="(max-width: 767px) 82vw, (max-width: 1040px) 25vw, 30vw"
              />
              <div className="ainow-model-stage__trust-copy">
                <dt>{item.value}</dt>
                <dd>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </dd>
              </div>
            </div>
          ))}
        </dl>

        <section className="ainow-model-stage__brand ainow-model-stage__visual-card" aria-label={copy.brand.title}>
          <AiNowImage
            className="ainow-model-stage__brand-image"
            src="/graphics-3d/products/aiaudit-evidence-v1.png"
            alt=""
            fill
            frameClassName="absolute inset-0"
            sizes="(max-width: 767px) 100vw, 100vw"
          />
          <div className="ainow-model-stage__brand-scrim" aria-hidden="true" />
          <div className="ainow-model-stage__brand-copy">
            <span>{copy.brand.established}</span>
            <h3>{copy.brand.title}</h3>
            <p>{copy.brand.language}</p>
            <small>{copy.brand.location}</small>
          </div>
        </section>
      </section>
    </AiNowSectionFrame>
  );
}
