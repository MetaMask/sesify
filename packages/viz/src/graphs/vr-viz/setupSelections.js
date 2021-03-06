import * as THREE from 'three'

const raycaster = new THREE.Raycaster()
const intersected = []
const tempMatrix = new THREE.Matrix4()
/* eslint-disable-next-line no-empty-function */
const noop = () => {}

export default function setup ({
  getIntersectables = () => [],
  onSelectStart = noop,
  onSelectEnd = noop,
  controller1,
  controller2,
  subscribeTick,
}) {
  controller1.addEventListener('selectstart', testSelectStart)
  controller1.addEventListener('selectend', testSelectEnd)
  controller2.addEventListener('selectstart', testSelectStart)
  controller2.addEventListener('selectend', testSelectEnd)
  subscribeTick(tickHandler)

  function tickHandler () {
    cleanIntersected()
    intersectObjects(controller1)
    intersectObjects(controller2)
  }

  function testSelectStart (event) {
    const controller = event.target
    const intersections = getIntersections(controller)
    if (intersections.length <= 0) {
      return
    }
    const [intersection] = intersections
    controller.userData.selected = intersection
    onSelectStart(intersection)
    // const object = intersection.object;
    // object.material.emissive.b = 1;
    // controller.userData.prevParent = object.parent
    // controller.userData.selected = object;
    // controller.attach(object);
  }

  function testSelectEnd (event) {
    const controller = event.target
    if (controller.userData.selected === undefined) {
      return
    }
    controller.userData.selected = undefined
    const intersections = getIntersections(controller)
    const [intersection] = intersections
    onSelectEnd(intersection)

    //   var object = controller.userData.selected;
    //   object.material.emissive.b = 0;
    //   controller.userData.prevParent.attach(object)
    //   controller.userData.prevParent = undefined;
    //   controller.userData.selected = undefined;
    // }
  }

  function getIntersections (controller) {
    tempMatrix.identity().extractRotation(controller.matrixWorld)
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld)
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix)
    return raycaster.intersectObjects(getIntersectables())
  }

  function intersectObjects (controller) {
    // Do not highlight when already selected
    if (controller.userData.selected !== undefined) {
      return
    }
    const line = controller.getObjectByName('line')
    const intersections = getIntersections(controller)
    if (intersections.length > 0) {
      const [intersection] = intersections
      const { object } = intersection
      object.material.emissive.r = 1
      intersected.push(object)
      line.scale.z = intersection.distance
    } else {
      line.scale.z = 5
    }
  }

  function cleanIntersected () {
    while (intersected.length) {
      const object = intersected.pop()
      object.material.emissive.r = 0
    }
  }
}
