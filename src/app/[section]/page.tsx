import { notFound } from "next/navigation";

// Every section now has its own page. Anything else under the site root is a real 404.
export default function Unknown() { notFound(); }
