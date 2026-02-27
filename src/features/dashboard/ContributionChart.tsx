import styles from "./ContributionChart.module.css"

interface ContributionChartProps {
  data: Array<{ date: string; count: number }>
}

const getIntensity = (count: number, max: number): number => {
  if (count === 0 || max === 0) return 0
  const ratio = count / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

export const ContributionChart = ({ data }: ContributionChartProps) => {
  const max = Math.max(...data.map((d) => d.count), 1)
  const totalContributions = data.reduce((sum, d) => sum + d.count, 0)

  const weeks: Array<Array<{ date: string; count: number }>> = []
  let currentWeek: Array<{ date: string; count: number }> = []

  for (const day of data) {
    const dayOfWeek = new Date(day.date + "T12:00:00").getDay()
    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(day)
  }
  if (currentWeek.length > 0) weeks.push(currentWeek)

  return (
    <div className={styles.container}>
      <div className={styles.chartWrap}>
        <div className={styles.chart}>
          {weeks.map((week, wi) => (
            <div key={wi} className={styles.week}>
              {week.map((day) => (
                <div
                  key={day.date}
                  className={`${styles.cell} ${styles[`intensity${getIntensity(day.count, max)}`]}`}
                  title={`${day.date}: ${day.count} contribution${day.count !== 1 ? "s" : ""}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.footer}>
        <span className={styles.total}>{totalContributions} contributions in the last 4 weeks</span>
        <div className={styles.legend}>
          <span className={styles.legendLabel}>Less</span>
          <div className={`${styles.legendCell} ${styles.intensity0}`} />
          <div className={`${styles.legendCell} ${styles.intensity1}`} />
          <div className={`${styles.legendCell} ${styles.intensity2}`} />
          <div className={`${styles.legendCell} ${styles.intensity3}`} />
          <div className={`${styles.legendCell} ${styles.intensity4}`} />
          <span className={styles.legendLabel}>More</span>
        </div>
      </div>
    </div>
  )
}

interface LanguageBarProps {
  languages: Array<{ language: string; count: number; color: string }>
}

export const LanguageBar = ({ languages }: LanguageBarProps) => {
  const total = languages.reduce((sum, l) => sum + l.count, 0)
  if (total === 0) return null

  return (
    <div className={styles.langContainer}>
      <div className={styles.langBar}>
        {languages.map((lang) => (
          <div
            key={lang.language}
            className={styles.langSegment}
            style={{
              width: `${(lang.count / total) * 100}%`,
              backgroundColor: lang.color,
            }}
            title={`${lang.language}: ${lang.count} repo${lang.count !== 1 ? "s" : ""}`}
          />
        ))}
      </div>
      <div className={styles.langLabels}>
        {languages.slice(0, 5).map((lang) => (
          <div key={lang.language} className={styles.langLabel}>
            <span className={styles.langDot} style={{ backgroundColor: lang.color }} />
            <span className={styles.langName}>{lang.language}</span>
            <span className={styles.langCount}>{Math.round((lang.count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
