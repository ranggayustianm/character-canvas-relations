import { BoardEditor } from "@/components/BoardEditor";

export default async function BoardPage({
  params,
}: PageProps<"/board/[id]">) {
  const { id } = await params;
  return <BoardEditor boardId={id} />;
}
