import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function GroupSettingsRedirectPage({ params }: PageProps) {
  const { groupId } = await params;
  redirect(`/groups/${groupId}#group-settings`);
}
