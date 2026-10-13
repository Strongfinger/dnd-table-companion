// The rules text of one SRD feature (class feature, species trait or feat) when its card is opened: DND-TH's
// Thai text with a ไทย/EN switch when there is one, else the English SRD text. The list row
// shows the Thai name.
import type { FeatureTh } from '../model/featuresTh'
import { WithThai } from '../ui/ThaiText'
import { FormattedText } from './FeatureCatalog'

export default function FeatureText({ text, th }: { text: string; th?: FeatureTh }) {
  return <WithThai th={th?.text}><div className="text-sm"><FormattedText text={text} /></div></WithThai>
}
