
module.exports = {
  getMemberExpressionNesting,
  getKeysForMemberExpressionChain,
  isDirectMemberExpression,
  isUndefinedCheck,
  getTailmostMatchingChain,
  reduceToTopmostApiCalls,
}

function getMemberExpressionNesting(identifierNode) {
  // remove the identifier node itself
  const parents = identifierNode.parents.slice(0, -1)
  // find unbroken membership chain closest to identifier
  const memberExpressions = getTailmostMatchingChain(parents, isDirectMemberExpression).reverse()
  return memberExpressions
}

function getKeysForMemberExpressionChain(memberExpressions) {
  const keys = memberExpressions.map(member => member.property.name)
  const rootMemberExpression = memberExpressions[0]
  const rootName = rootMemberExpression.object.name
  keys.unshift(rootName)
  return keys
}

function isDirectMemberExpression(node) {
  return node.type === 'MemberExpression' && !node.computed
}

function isUndefinedCheck(identifierNode) {
  const parentExpression = identifierNode.parents[identifierNode.parents.length - 2]
  const isTypeof = (parentExpression.type === 'UnaryExpression' || parentExpression.operator === 'typeof')
  return isTypeof
}

function getTailmostMatchingChain(items, matcher) {
  const onlyMatched = items.map(item => matcher(item) ? item : null)
  const lastIndex = onlyMatched.lastIndexOf(null)
  if (lastIndex === -1) return onlyMatched.slice()
  return onlyMatched.slice(lastIndex + 1)
}

// if array contains 'x' and 'x.y' just keep 'x'
function reduceToTopmostApiCalls(globalsConfig) {
  const allPaths = Array.from(globalsConfig.keys()).sort()
  return allPaths.forEach((path) => {
    const parts = path.split('.')
    // only one part, safe to keep
    if (parts.length === 1) {
      return
    }
    // 'x.y.z' has parents 'x' and 'x.y'
    const parentParts = parts.slice(0, -1)
    const parents = parentParts.map((_, index) => parentParts.slice(0, index + 1).join('.'))
    // dont include this if a parent appears in the array
    const parentsAlreadyInArray = parents.some(parent => allPaths.includes(parent))
    if (parentsAlreadyInArray) {
      globalsConfig.delete(path)
      return
    }
    // if no parents found, ok to include
  })
}