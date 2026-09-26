import TextRow from './TextRow.jsx'
import ImageRow from './ImageRow.jsx'

// text / accordion / teaser / title -> TextRow, image -> ImageRow.
export default function ComponentRow({ component, index, text, image }) {
  if (component.type === 'image') {
    return <ImageRow component={component} index={index} {...image} />
  }
  return <TextRow component={component} index={index} {...text} />
}
