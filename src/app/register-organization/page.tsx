import { redirect } from "next/navigation";

export default function Page() {
  redirect("/register?role=ORGANIZATION_ADMIN");
}
