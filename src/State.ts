// @class State
// @description with a couple exceptions, supergroups should not
// mutate after creation. States are a way to track selection/highlighting
// states without mutating.
export class State {
  list: any
  selectedVals: any[]

  constructor(list: any) {
    this.list = list
    this.selectedVals = []
  }

  selectByVal(val: any) {
    if (val.rootList() !== this.list) { // assume state only on root lists
      throw new Error('state only on root lists (if state even does anything)')
    }
    this.selectedVals.push(val)
  }

  selectedRecs() {
    return _.chain(this.selectedVals).map('records').flatten().value()
  }
}
