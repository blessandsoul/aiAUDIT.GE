export type CoverDimensions = { width: number; height: number }

const COVER_DIMENSIONS: Record<string, CoverDimensions> = {
    "/images/aiaudit/blog/ai-auditi-biznesistvis-saqartveloshi-glass-v1.png": { width: 1536, height: 1024 },
    "/images/aiaudit/blog/ai-auditis-kompaniis-archeva-glass-v1.png": { width: 1536, height: 1024 },
    "/images/aiaudit/blog/ai-danergvis-fasi-biujetis-shefaseba-glass-v1.png": { width: 1536, height: 1024 },
    "/images/aiaudit/blog/ai-pilotis-gegma-kpi-biujeti-glass-v1.png": { width: 1536, height: 1024 },
    "/images/aiaudit/blog/biznes-procesebis-auditi-avtomatizaciamde-glass-v1.png": { width: 1536, height: 1024 },
    "/images/aiaudit/blog/crm-monacemebis-auditi-ai-integraciamde-glass-v1.png": { width: 1536, height: 1024 },
    "/images/aiaudit/blog/dokumentbrunvis-auditi-ocr-avtomatizaciamde-glass-v1.png": { width: 1536, height: 1024 },
    "/images/aiaudit/blog/gayidvebis-procesis-auditi-avtomatizaciistvis-glass-v1.png": { width: 1536, height: 1024 },
    "/images/aiaudit/blog/marketingis-procesebis-auditi-ai-avtomatizaciamde-glass-v1.png": { width: 1536, height: 1024 },
    "/images/aiaudit/blog/momkhmarebelta-momsakhurebis-auditi-chatbotamde-glass-v1.png": { width: 1536, height: 1024 },
    "/images/blog-covers/ai-auditis-angarishis-mighebis-checklist.png": { width: 1672, height: 941 },
    "/images/blog-covers/ai-auditis-mosamzadebeli-masalebi.png": { width: 1600, height: 900 },
    "/images/blog-covers/arsebuli-aplikaciis-teqnikuri-shefaseba.png": { width: 1672, height: 941 },
    "/images/blog-covers/chaflukebuli-ai-pilotis-postmortem.png": { width: 1672, height: 941 },
    "/images/blog-covers/cocxali-specialistis-sachiroebis-ai-auditi.png": { width: 1672, height: 941 },
    "/images/blog-covers/influenseris-kampaniis-atribuciis-auditi.png": { width: 1672, height: 941 },
    "/images/blog-covers/menedjmentis-angarishgebis-procesis-auditi.png": { width: 1672, height: 941 },
    "/images/blog-covers/sawyobis-inventaris-sheusrulebis-auditi.png": { width: 1672, height: 941 },
    "/images/blog-covers/shekvetis-shesrulebis-da-dabrunebis-auditi.png": { width: 1672, height: 941 },
    "/images/blog-covers/shesyidvebis-damtkicebis-procesis-auditi.png": { width: 1672, height: 941 },
}

export function getCoverDimensions(coverPath: string): CoverDimensions | undefined {
    return Object.hasOwn(COVER_DIMENSIONS, coverPath) ? COVER_DIMENSIONS[coverPath] : undefined
}
