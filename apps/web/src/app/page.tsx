import HomeHero from '@/components/home/HomeHero'
import HomeServices from '@/components/home/HomeServices'
import HomeFeatures from '@/components/home/HomeFeatures'
import HomeSteps from '@/components/home/HomeSteps'
import HomeCTA from '@/components/home/HomeCTA'

export default function Home() {
  return (
    <div>
      <HomeHero />
      <HomeServices />
      <HomeFeatures />
      <HomeSteps />
      <HomeCTA />
    </div>
  )
}
