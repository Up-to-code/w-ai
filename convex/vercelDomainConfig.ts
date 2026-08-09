export type VercelRecommendedIPv4 = {
  rank: number;
  value: string[];
};

export type VercelRecommendedCname = {
  rank: number;
  value: string;
};

export type VercelDomainConfiguration = {
  configuredBy: "A" | "CNAME" | "dns-01" | "http" | null;
  acceptedChallenges: Array<"dns-01" | "http-01">;
  recommendedIPv4: VercelRecommendedIPv4[];
  recommendedCNAME: VercelRecommendedCname[];
  misconfigured: boolean;
};

function preferredRank<T extends { rank: number }>(records: T[]) {
  return [...records]
    .filter((record) => Number.isFinite(record.rank))
    .sort((left, right) => left.rank - right.rank);
}

function cleanDnsTarget(value: string | undefined) {
  const target = value?.trim().replace(/\.$/, "");
  return target || undefined;
}

/**
 * Selects Vercel's highest-priority project-specific DNS targets while keeping
 * the configured platform defaults as a compatibility fallback.
 */
export function preferredVercelDnsTargets(
  config: VercelDomainConfiguration,
  fallback: { cnameTarget: string; apexTarget: string },
) {
  const cnameTarget = cleanDnsTarget(
    preferredRank(config.recommendedCNAME).find((record) =>
      Boolean(cleanDnsTarget(record.value)),
    )?.value,
  );
  const apexTarget = cleanDnsTarget(
    preferredRank(config.recommendedIPv4)
      .flatMap((record) => record.value)
      .find((value) => Boolean(cleanDnsTarget(value))),
  );

  return {
    cnameTarget: cnameTarget ?? fallback.cnameTarget,
    apexTarget: apexTarget ?? fallback.apexTarget,
  };
}
