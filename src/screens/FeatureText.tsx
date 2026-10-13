// The rules text of one SRD feature (class feature, species trait or feat) when its card is opened: DND-TH's
// Thai text with a ไทย/EN switch when there is one (feats so far), else the English SRD text. The list row
// shows the Thai name.
import type { FeatureTh } from '../model/featuresTh'
import MiniMarkdown from '../ui/MiniMarkdown'
import { LangSwitch, ThaiCredit } from '../ui/ThaiText'
import { FormattedText } from './FeatureCatalog'
import { useTextLang } from './useSrdData'

export default function FeatureText({ text, th }: { text: string; th?: FeatureTh }) {
  const [lang, setLang] = useTextLang()
  if (!th) return <div className="text-sm"><FormattedText text={text} /></div>
  return (
    <div className="mt-1 space-y-2 text-sm text-stone-300">
      <div className="flex justify-end"><LangSwitch lang={lang} onChange={setLang} /></div>
      {lang === 'th' ? <><MiniMarkdown text={th.text} /><ThaiCredit /></> : <FormattedText text={text} />}
    </div>
  )
}
