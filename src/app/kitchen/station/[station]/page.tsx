import { StaffLogin } from "@/components/staff/StaffLogin";
import StationDisplay from "@/components/kitchen/StationDisplay";

export default function StationPage({
	params,
}: {
	params: Promise<{ station: string }>;
}) {
	return (
		<StaffLogin requiredRole="staff">
			<StationDisplay stationSlug={params} />
		</StaffLogin>
	);
}
