"use client";

type Meeting = {
  date: string;
  competition: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
};

type HeadToHeadProps = {
  homeTeam: string;
  awayTeam: string;
  meetings?: Meeting[];
};

export default function HeadToHead({
  homeTeam,
  awayTeam,
  meetings = [],
}: HeadToHeadProps) {
  const homeWins = meetings.filter(
    (m) =>
      (m.home === homeTeam && m.homeScore > m.awayScore) ||
      (m.away === homeTeam && m.awayScore > m.homeScore)
  ).length;

  const awayWins = meetings.filter(
    (m) =>
      (m.home === awayTeam && m.homeScore > m.awayScore) ||
      (m.away === awayTeam && m.awayScore > m.homeScore)
  ).length;

  const draws = meetings.length - homeWins - awayWins;

  const homeGoals = meetings.reduce(
    (sum, m) =>
      sum + (m.home === homeTeam ? m.homeScore : m.awayScore),
    0
  );

  const awayGoals = meetings.reduce(
    (sum, m) =>
      sum + (m.home === awayTeam ? m.homeScore : m.awayScore),
    0
  );

  const highestHome = meetings
    .filter((m) => m.homeScore !== m.awayScore)
    .map((m) => ({
      ...m,
      winner: m.homeScore > m.awayScore ? m.home : m.away,
      margin: Math.abs(m.homeScore - m.awayScore),
    }))
    .filter((m) => m.winner === homeTeam)
    .sort((a, b) => b.margin - a.margin)[0];

  const highestAway = meetings
    .filter((m) => m.homeScore !== m.awayScore)
    .map((m) => ({
      ...m,
      winner: m.homeScore > m.awayScore ? m.home : m.away,
      margin: Math.abs(m.homeScore - m.awayScore),
    }))
    .filter((m) => m.winner === awayTeam)
    .sort((a, b) => b.margin - a.margin)[0];

  const total = homeWins + draws + awayWins || 1;

  return (
    <section className="mt-5 overflow-hidden rounded-xl bg-[#171b25] text-white">
      <div className="border-b border-white/10 px-4 py-4">
        <h2 className="text-lg font-bold">Head to Head</h2>
        <p className="mt-1 text-xs text-gray-400">
          Previous meetings between {homeTeam} and {awayTeam}
        </p>
      </div>

      <div className="p-4">
        <h3 className="mb-5 text-center text-sm font-semibold text-gray-300">
          PREVIOUS MEETINGS
        </h3>

        {meetings.length > 0 ? (
          <>
            <div className="grid grid-cols-3 items-center text-center">
              <div>
                <p className="font-bold text-green-400">{homeTeam}</p>
                <p className="text-xs text-gray-400">Wins</p>
                <p className="text-3xl font-bold text-green-400">{homeWins}</p>
              </div>

              <div>
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-[9px] border-green-500 border-r-red-500 border-b-red-500">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{draws}</p>
                    <p className="text-xs text-gray-400">Draws</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="font-bold text-red-400">{awayTeam}</p>
                <p className="text-xs text-gray-400">Wins</p>
                <p className="text-3xl font-bold text-red-400">{awayWins}</p>
              </div>
            </div>

            <h3 className="mb-4 mt-8 text-center text-sm font-semibold text-gray-300">
              HIGHEST WIN
            </h3>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-[#222936] p-3">
                <p className="text-xs text-gray-400">{homeTeam}</p>
                <p className="mt-2 font-bold text-green-400">
                  {highestHome
                    ? `${highestHome.homeScore}-${highestHome.awayScore}`
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-[#222936] p-3">
                <p className="text-xs text-gray-400">{awayTeam}</p>
                <p className="mt-2 font-bold text-red-400">
                  {highestAway
                    ? `${highestAway.homeScore}-${highestAway.awayScore}`
                    : "—"}
                </p>
              </div>
            </div>

            <h3 className="mb-4 mt-8 text-center text-sm font-semibold text-gray-300">
              AVERAGES
            </h3>

            <div className="space-y-4">
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-bold text-green-400">
                    {(homeGoals / meetings.length).toFixed(1)}
                  </span>
                  <span className="text-gray-300">Goals scored</span>
                  <span className="font-bold text-red-400">
                    {(awayGoals / meetings.length).toFixed(1)}
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-gray-700">
                  <div
                    className="bg-green-500"
                    style={{
                      width: `${(homeGoals / (homeGoals + awayGoals || 1)) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-red-500"
                    style={{
                      width: `${(awayGoals / (homeGoals + awayGoals || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <h3 className="mb-4 mt-8 text-center text-sm font-semibold text-gray-300">
              LAST 5 MATCHES
            </h3>

            <div className="space-y-4">
              {meetings.slice(0, 5).map((m, index) => (
                <div
                  key={`${m.date}-${index}`}
                  className="border-b border-white/10 pb-3 last:border-0"
                >
                  <p className="mb-2 text-[11px] text-gray-400">
                    {m.date} | {m.competition}
                  </p>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex-1">{m.home}</span>
                    <strong className="text-base">
                      {m.homeScore} : {m.awayScore}
                    </strong>
                    <span className="flex-1 text-right">{m.away}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-lg bg-[#222936] px-4 py-8 text-center">
            <p className="font-semibold text-gray-200">
              Historical statistics unavailable
            </p>
            <p className="mt-2 text-xs leading-5 text-gray-400">
              Previous meeting records will appear here when verified
              historical results are available.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
