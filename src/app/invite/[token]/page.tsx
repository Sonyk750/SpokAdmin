import InviteClient from "./InviteClient"

type Props = { params: Promise<{ token: string }> }

export const metadata = { title: "Invitație — Administrare Asociații" }

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  return <InviteClient token={token} />
}
