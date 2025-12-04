"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function RFIPage() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <div>
      <nav className="mb-4 text-sm text-gray-600">
        <Link href="/dashboard" className="hover:text-primary-600">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <Link href="/projects" className="hover:text-primary-600">
          Projects
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/projects/${projectId}`} className="hover:text-primary-600">
          Project
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">RFI</span>
      </nav>

      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <h1 className="text-3xl font-bold mb-4">Request for Information (RFI)</h1>
        <p className="text-gray-600 mb-2">
          Create and manage RFI questionnaires and vendor responses
        </p>
        <p className="text-gray-400 text-sm italic">Coming soon</p>
      </div>
    </div>
  );
}




