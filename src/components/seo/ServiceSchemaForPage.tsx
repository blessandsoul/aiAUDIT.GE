import { getTranslations } from "next-intl/server";
import { ServiceSchema } from "./ServiceSchema";
import { BreadcrumbSchema } from "./BreadcrumbSchema";

const SERVICES_LABEL: Record<string, string> = {
  ka: "სერვისები",
  en: "Services",
  ru: "Услуги",
  de: "Services",
};

type Offer = {
  name: string;
  price: string;
  priceCurrency?: string;
  unitText?: string;
};

type Props = {
  locale: string;
  namespace: string;
  path: string;
  serviceType: string;
  offers?: Offer[];
};

export async function ServiceSchemaForPage({
  locale,
  namespace,
  path,
  serviceType,
  offers,
}: Props) {
  const t = await getTranslations({ locale, namespace });
  const base = locale === "ka" ? "https://ainow.ge" : `https://ainow.ge/${locale}`;
  const url = `${base}${path}`;

  const crumbs = [{ name: "aiNOW", item: base || "https://ainow.ge" }];
  if (path.startsWith("/services/")) {
    crumbs.push({ name: SERVICES_LABEL[locale] ?? "Services", item: `${base}/services` });
  }
  crumbs.push({ name: t("title"), item: url });

  return (
    <>
      <ServiceSchema
        name={t("title")}
        description={t("description")}
        url={url}
        serviceType={serviceType}
        offers={offers}
      />
      <BreadcrumbSchema crumbs={crumbs} />
    </>
  );
}
