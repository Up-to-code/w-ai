import type { Id } from "@/convex/_generated/dataModel";
import { CmsCollectionManager } from "@/components/dashboard/cms-collection-manager";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;
  return <CmsCollectionManager collectionId={collectionId as Id<"cmsCollections">} />;
}
