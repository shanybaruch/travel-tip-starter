import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'


var gUserPos = null
var gCurrentLoc = null


window.onload = onInit

// To make things easier in this project structure 
// functions that are called from DOM are defined on a global app object
window.app = {
    onRemoveLoc,
    onUpdateLoc,
    onSelectLoc,
    onPanToUserPos,
    onSearchAddress,
    onCopyLoc,
    onShareLoc,
    onSetSortBy,
    onSetFilterBy,
    onAddLoc,
    loadAndRenderLocs,
    onSaveUpdateLoc,
    closeSelectLoc,
}

function onInit() {
    getFilterByFromQueryParams()
    loadAndRenderLocs()
    mapService.initMap()
        .then(() => {
            // onPanToTokyo()
            mapService.addClickListener(getInfoForAddLoc)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot init map')
        })
}

function renderLocs(locs) {
    console.log(locs)

    const selectedLocId = getLocIdFromQueryParams()

    var strHTML = locs.map(loc => {
        const className = (loc.id === selectedLocId) ? 'active' : ''
        var distanceHtml = ''
        if (gUserPos) {
            distanceHtml =
                ` <p class="loc-distance"> distance ${utilService.getDistance(gUserPos, loc.geo)}km
                 </p>`
        }
        return `
        <li class="loc ${className}" data-id="${loc.id}">
            <div>
                <h4>  
                    <span>${loc.name}</span>
                    <span title="${loc.rate} stars" class="stars">${'★'.repeat(loc.rate)}</span>
                </h4>
                <div class="more-details">
                <p class="muted">
                Created in ${utilService.elapsedTime(loc.createdAt)}
                ${(loc.createdAt !== loc.updatedAt) ?
                ` <br> Updated ${utilService.elapsedTime(loc.updatedAt)}`
                : ''}
                   </p>
                   ${distanceHtml} 
                </div>
            </div> 
            <div class="loc-btns">     
                <button title="Delete" class="fa-solid fa-trash-can" onclick="app.onRemoveLoc('${loc.id}')"></button>
                <button title="Edit" class="fa-solid fa-pen-to-square" onclick="app.onUpdateLoc('${loc.id}')"></button>
                <button title="Select" class="fa-solid fa-location-dot" onclick="app.onSelectLoc('${loc.id}')"></button>
            </div>     
        </li>`}).join('')

    const elLocList = document.querySelector('.loc-list')
    elLocList.innerHTML = strHTML || 'No locs to show'

    renderLocStats()

    if (selectedLocId) {
        const selectedLoc = locs.find(loc => loc.id === selectedLocId)
        displayLoc(selectedLoc)
    }
    document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
}

function onRemoveLoc(locId) {
    locService.confirmRemove().then((confirmed) => {
        if (confirmed) {
            locService.remove(locId)
                .then(() => {
                    flashMsg('Location removed')
                    unDisplayLoc()
                    loadAndRenderLocs()
                })
                .catch(err => {
                    console.error('OOPs:', err)
                    flashMsg('Cannot remove location')
                })
        }
    })
}

function onSearchAddress(ev) {
    ev.preventDefault()
    const el = document.querySelector('[name=address]')
    mapService.lookupAddressGeo(el.value)
        .then(geo => {
            mapService.panTo(geo)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot lookup address')
        })
}

function getInfoForAddLoc(geo) {
    const elDialog = document.querySelector('.dialog-add-loc')
    var elLoc = document.querySelector('.loc-add')
    var elRate = document.querySelector('.rate-add')

    elDialog.showModal()
    elLoc.value = geo.address

    elDialog.dataset.geo = JSON.stringify(geo)
}

function onAddLoc(ev) {
    console.log(ev)

    ev?.preventDefault()

    const elDialog = document.querySelector('.dialog-add-loc')
    var elLoc = document.querySelector('.loc-add')
    var elRate = document.querySelector('.rate-add')

    const geo = JSON.parse(elDialog.dataset.geo)

    var loc = {
        name: elLoc.value,
        rate: elRate.value,
        geo
    }

    locService.save(loc)
        .then((savedLoc) => {
            elDialog.close()
            flashMsg(`Added Location (id: ${savedLoc.id})`)
            utilService.updateQueryParams({ locId: savedLoc.id })
            loadAndRenderLocs()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot add location')
        })
}

function loadAndRenderLocs() {
    locService.query()
        .then(renderLocs)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot load locations')
        })
}

function onPanToUserPos() {
    mapService.getUserPosition()
        .then(latLng => {
            mapService.panTo({ ...latLng, zoom: 15 })
            unDisplayLoc()
            loadAndRenderLocs()
            flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)
            gUserPos = latLng

            const loc = {
                id: 'user-pos',
                name: 'You are here',
                rate: 0,
                geo: { lat: latLng.lat, lng: latLng.lng }
            }
            mapService.setMarker(loc)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot get your position')
        })
}

function onUpdateLoc(locId) {
    // console.log(locId)
    const elDialog = document.querySelector('.dialog-update-loc')
    var elLoc = document.querySelector('.loc-update')
    var elRate = document.querySelector('.rate-update')

    locService.query()
        .then(locs => {
            const thisLoc = locs.find(loc => loc.id === locId)
            if (!thisLoc) return console.error('Location not found')

            gCurrentLoc = thisLoc

            elLoc.value = thisLoc.name
            elRate.value = thisLoc.rate
            elDialog.showModal()

        })
}

function onSaveUpdateLoc() {
    const elDialog = document.querySelector('.dialog-update-loc')
    var elLoc = document.querySelector('.loc-update')
    var elRate = document.querySelector('.rate-update')

    const updatedLoc = {
        ...gCurrentLoc,
        name: elLoc.value,
        rate: elRate.value,
    }
    locService.save(updatedLoc)
        .then((savedLoc) => {
            elDialog.close()
            flashMsg(`Updated Location (id: ${savedLoc.id})`)
            utilService.updateQueryParams({ locId: savedLoc.id })
            loadAndRenderLocs()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot update location')
        })
}

function onSelectLoc(locId) {
    return locService.getById(locId)
        .then(displayLoc)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot display this location')
        })
}

function displayLoc(loc) {
    document.querySelector('.loc.active')?.classList?.remove('active')
    document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')

    mapService.panTo(loc.geo)
    mapService.setMarker(loc)
    console.log(loc)

    const el = document.querySelector('.selected-loc')
    el.querySelector('.loc-name').innerText = loc.name
    el.querySelector('.loc-address').innerText = loc.geo.address
    el.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)
    el.querySelector('[name=loc-copier]').value = window.location
    el.classList.add('show')

    utilService.updateQueryParams({ locId: loc.id })
}

function unDisplayLoc() {
    utilService.updateQueryParams({ locId: '' })
    document.querySelector('.selected-loc').classList.remove('show')
    mapService.setMarker(null)
}

function onCopyLoc() {
    const elCopy = document.querySelector('[name=loc-copier]')
    elCopy.select()
    elCopy.setSelectionRange(0, 99999) // For mobile devices
    navigator.clipboard.writeText(elCopy.value)
    flashMsg('Link copied, ready to paste')
}

function onShareLoc() {
    const url = document.querySelector('[name=loc-copier]').value

    // title and text not respected by any app (e.g. whatsapp)
    const data = {
        title: 'Cool location',
        text: 'Check out this location',
        url
    }
    navigator.share(data)
}

function flashMsg(msg) {
    const el = document.querySelector('.user-msg')
    el.innerText = msg
    el.classList.add('open')
    setTimeout(() => {
        el.classList.remove('open')
    }, 3000)
}

function getFilterByFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const txt = queryParams.get('txt') || ''
    const minRate = queryParams.get('minRate') || 0
    locService.setFilterBy({ txt, minRate })

    document.querySelector('input[name="filter-by-txt"]').value = txt
    document.querySelector('input[name="filter-by-rate"]').value = minRate
}

function getLocIdFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const locId = queryParams.get('locId')
    return locId
}

function onSetSortBy() {
    const prop = document.querySelector('.sort-by').value
    const isDesc = document.querySelector('.sort-desc').checked

    if (!prop) return

    const sortBy = {}
    sortBy[prop] = (isDesc) ? -1 : 1

    // Shorter Syntax:
    // const sortBy = {
    //     [prop] : (isDesc)? -1 : 1
    // }

    locService.setSortBy(sortBy)
    loadAndRenderLocs()
}

function onSetFilterBy({ txt, minRate }) {
    const filterBy = locService.setFilterBy({ txt, minRate: +minRate })
    utilService.updateQueryParams(filterBy)
    loadAndRenderLocs()
}

function renderLocStats() {
    locService.getLocCountByRateMap().then(stats => {
        handleStats(stats, 'loc-stats-rate')
    })
    locService.getLocCountByUpdates().then(stats => {
        handleStats(stats, 'loc-stats-updates')
    })
}

function closeSelectLoc() {
    document.querySelector('.loc.active').classList.remove('active')
    document.querySelector('.selected-loc').classList.remove('show')
    unDisplayLoc()
}

function handleStats(stats, selector) {
    // stats = { low: 37, medium: 11, high: 100, total: 148 }
    // stats = { low: 5, medium: 5, high: 5, baba: 55, mama: 30, total: 100 }
    const labels = cleanStats(stats)
    const colors = utilService.getColors()

    var sumPercent = 0
    var colorsStr = `${colors[0]} ${0}%, `
    labels.forEach((label, idx) => {
        if (idx === labels.length - 1) return
        const count = stats[label]
        const percent = Math.round((count / stats.total) * 100, 2)
        sumPercent += percent
        colorsStr += `${colors[idx]} ${sumPercent}%, `
        if (idx < labels.length - 1) {
            colorsStr += `${colors[idx + 1]} ${sumPercent}%, `
        }
    })

    colorsStr += `${colors[labels.length - 1]} ${100}%`
    // Example:
    // colorsStr = `purple 0%, purple 33%, blue 33%, blue 67%, red 67%, red 100%`

    const elPie = document.querySelector(`.${selector} .pie`)
    // console.log(elPie);
    // console.log(selector);


    const style = `background-image: conic-gradient(${colorsStr})`
    elPie.style = style

    const ledendHTML = labels.map((label, idx) => {
        return `
                <li>
                    <span class="pie-label" style="background-color:${colors[idx]}"></span>
                    ${label} (${stats[label]})
                </li>
            `
    }).join('')

    const elLegend = document.querySelector(`.${selector} .legend`)
    elLegend.innerHTML = ledendHTML
}

function cleanStats(stats) {
    const cleanedStats = Object.keys(stats).reduce((acc, label) => {
        if (label !== 'total' && stats[label]) {
            acc.push(label)
        }
        return acc
    }, [])
    return cleanedStats
}
