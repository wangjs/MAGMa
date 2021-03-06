/**
 * Scans controller.
 *
 * Handles actions performed on the scan views.
 * @author <a href="mailto:s.verhoeven@esciencecenter.nl">Stefan Verhoeven</a>
 */
Ext.define('Esc.magmaweb.controller.Scans', {
  extend: 'Ext.app.Controller',
  views: ['scan.Panel'],
  refs: [{
    ref: 'chromatogramPanel',
    selector: 'scanpanel'
  }, {
    ref: 'chromatogram',
    selector: 'chromatogram'
  }, {
    ref: 'uploadForm',
    selector: 'scanuploadform'
  }],
  uses: [
    'Ext.window.MessageBox',
    'Ext.window.Window',
    'Ext.form.Panel',
    'Esc.magmaweb.view.scan.UploadFieldSet',
    'Esc.magmaweb.view.fragment.AnnotateFieldSet'
  ],
  /**
   * Cached scans which belong to (filtered) molecules
   */
  scans_of_molecules: [],
  init: function() {
    Ext.log({}, 'Scans controller init');
    var me = this;

    this.control({
      'chromatogram': {
        selectscan: function(scanid) {
          me.application.fireEvent('selectscan', scanid);
        },
        unselectscan: function(scanid) {
          me.application.fireEvent('noselectscan', scanid);
        },
        mouseoverscan: function(scan) {
          if ('moleculeintensity' in scan) {
            this.getChromatogramPanel().setTitle(Ext.String.format(
              'Chromatogram (rt={0}, basepeak intensity={1}, molecule intensity={2}, scan={3})',
              scan.rt, scan.intensity, scan.moleculeintensity, scan.id
            ));
          } else {
            this.getChromatogramPanel().setTitle(Ext.String.format('Chromatogram (rt={0}, intensity={1}, scan={2})', scan.rt, scan.intensity, scan.id));
          }
        }
      },
      'scanpanel tool[action=search]': {
        click: this.searchScan
      },
      'scanpanel tool[action=clearselection]': {
        click: this.clearScanSelection
      },
      'scanpanel tool[action=center]': {
        click: this.center
      },
      'scanpanel tool[action=actions]': {
        click: this.showActionsMenu
      },
      'scanpanel tool[action=help]': {
        click: this.showHelp
      },
      'scanuploadform component[action=uploadmsdata]': {
        click: this.uploadHandler
      },
      'scanuploadform component[action=uploadmsdatacancel]': {
        click: this.showChromatogram
      },
      'scanuploadform component[action=loadmsdataexample]': {
        click: this.loadExample
      },
      'scanuploadform component[action=loadmsdataexample2]': {
        click: this.loadExample2
      },
      'scanuploadform component[action=loadmsdataexample3]': {
        click: this.loadExample3
      },
      'scanuploadform component[name=ms_data_format]': {
        change: this.changeMsDataFormat
      }
    });

    this.application.on('moleculeload', this.setScansOfMolecules, this);
    this.application.on('moleculeselect', this.loadExtractedIonChromatogram, this);
    this.application.on('moleculereselect', this.loadExtractedIonChromatogram, this);
    this.application.on('moleculedeselect', function() {
      this.resetScans();
      this.clearExtractedIonChromatogram();
    }, this);
    this.application.on('moleculenoselect', function() {
      this.resetScans();
      this.clearExtractedIonChromatogram();
    }, this);
    this.application.on('rpcsubmitsuccess', function() {
      Ext.getCmp('uploadmssaction').disable();
    });
    this.application.on('assignmentchanged', this.scanAssignmentChanged, this);
    this.application.on('mspectraload', function(scanid, mslevel) {
      var chromatogram = this.getChromatogram();
      if (mslevel === 1 && chromatogram.selectedScan !== scanid) {
        chromatogram.selectScan(scanid, true);
      }
    }, this);

    this.actionsMenu = Ext.create('Ext.menu.Menu', {
      items: [{
        iconCls: 'icon-add',
        id: 'uploadmssaction',
        text: 'Upload MS data',
        listeners: {
          click: {
            fn: this.showUploadForm,
            scope: this
          }
        }
      }, {
        text: 'Zoom direction',
        menu: {
          items: [{
            text: 'X axis',
            checked: true,
            checkHandler: function(item, checked) {
              me.onZoomDirectionXChange(item, checked);
            }
          }, {
            text: 'Y axis',
            checked: false,
            checkHandler: function(item, checked) {
              me.onZoomDirectionYChange(item, checked);
            }
          }]
        }
      }],
      hideUploadAction: function() {
        this.getComponent('uploadmssaction').hide();
      }
    });

    /**
     * @property {Boolean} hasMolecules
     * Whether there are structures.
     * Used to disable/enable annotate options
     */
    this.hasMolecules = false;
    /**
     * @property {Number} Molecule identifier
     * Extracted ion chromatogram is shown for this molecule
     */
    this.molid = null;

    this.application.addEvents(
      /**
       * @event
       * Triggered when a scan is selected.
       * @param {Number} scanid Scan identifier.
       */
      'selectscan',
      /**
       * @event
       * Triggered when no scan is selected anymore.
       */
      'noselectscan',
      /**
       * @event chromatogramload
       * Fired after chromatogram has been loaded
       * @param chromatogram Chromatogram
       */
      'chromatogramload'
    );

  },
  /**
   * Loads the chromatogram from server.
   */
  onLaunch: function() {
    this.loadChromatogram();
    this.applyRole();
  },
  loadChromatogram: function() {
    var me = this;
    // config chromatogram,
    // must be done after viewport so canvas is avaliable
    var chromatogram = this.getChromatogram();
    chromatogram.setLoading(true);
    d3.json(
      me.application.getUrls().chromatogram,
      function(data) {
        me.loadChromatogramCallback(data);
      }
    );
  },
  /**
   * Callback for loading chromatogram
   *
   * @param {Array} data Array of scans with rt, id and itensity props
   */
  loadChromatogramCallback: function(data) {
    if (data === null) {
      Ext.Error.raise({
        msg: 'Failed to load chromatogram from server'
      });
      return false;
    }
    var me = this;
    var chromatogram = me.getChromatogram();
    chromatogram.setLoading(false);
    Ext.log({}, 'Loading chromatogram');
    if (data.cutoff !== null) {
      chromatogram.cutoff = data.cutoff;
    }
    chromatogram.setData(data.scans);
    me.resetScans();
    if (data.scans.length === 0) {
      // when there are no scans then user should upload some
      me.showUploadForm();
    } else if (data.scans.length === 1) {
      me.selectScan(data.scans[0].id, false);
      me.getChromatogramPanel().collapse();
    }
    me.application.fireEvent('chromatogramload', chromatogram);
  },
  scanAssignmentChanged: function(isAssigned) {
    var chromatogram = this.getChromatogram();
    chromatogram.setAssignment(isAssigned);
  },
  clearExtractedIonChromatogram: function() {
    this.molid = null;
    this.getChromatogram().setExtractedIonChromatogram([]);
  },
  /**
   * Download the extracted ion chromatogram of a molecule on the chromatogram.
   * @param {Number} molid Metobolite identifier
   */
  loadExtractedIonChromatogram: function(molid) {
    Ext.log({}, 'Loading extracted ion chromatogram');
    var me = this;
    if (molid === this.molid) {
      return;
    }
    this.getChromatogram().setLoading(true);
    this.molid = molid;
    d3.json(
      Ext.String.format(this.application.getUrls().extractedionchromatogram, molid),
      function(data) {
        me.loadExtractedIonChromatogramCallback(data);
      }
    );
  },
  /**
   * Callback for loading a extracted ion chromatogram
   * @param {Object} data
   * @param {Array} data.scans Scans in which molecule has hits
   * @param {Array} data.chromatogram Foreach scan the intensity of the peak with molecule m/z
   */
  loadExtractedIonChromatogramCallback: function(data) {
    if (data === null) {
      Ext.Error.raise({
        msg: 'Failed to load extracted ion chromatogram from server'
      });
      return false;
    }
    var me = this;
    var chromatogram = me.getChromatogram();
    chromatogram.setLoading(false);
    chromatogram.setExtractedIonChromatogram(data.chromatogram);
    me.setScans(data.scans);
  },
  searchScan: function() {
    var me = this;
    Ext.MessageBox.prompt(
      'Scan#',
      'Please enter a level 1 scan identifier:',
      function(b, v) {
        if (b != 'cancel' && v) {
          v = v * 1;
          me.selectScan(v, true);
        }
      }
    );
  },
  clearScanSelection: function() {
    this.getChromatogram().clearScanSelection();
    this.application.fireEvent('noselectscan');
  },
  /**
   * Select a scan
   * @param {Number} scanid Scan identifier
   * @param {Boolean} [silent=false] Passing true will supress the 'unselectscan' event from being fired.
   */
  selectScan: function(scanid, silent) {
    this.getChromatogram().selectScan(scanid, silent);
    this.application.fireEvent('selectscan', scanid);
  },
  /**
   * Each time the molecule grid is loaded the response also contains a list of scans
   * where the filtered molecules have hits, we use this to mark the scans that can be selected
   *
   * @param {Esc.magmaweb.store.Molecules} moleculestore rawdata of store reader has scans
   */
  setScansOfMolecules: function(moleculestore) {
    this.hasMolecules = moleculestore.getTotalCount() > 0;
    this.scans_of_molecules = moleculestore.getProxy().getReader().rawData.scans;
    this.setScans(this.scans_of_molecules);
  },
  /**
   * Sets scans markers to scans where current molecule filter has hits.
   */
  resetScans: function() {
    this.setScans(this.scans_of_molecules);
  },
  /**
   * Add scan markers to chromatogram that can be selected.
   * @param {Array} scans Array of scans
   */
  setScans: function(scans) {
    Ext.log({}, 'Setting chromatogram scan markers');
    var chromatogram = this.getChromatogram();
    var selectedScan = chromatogram.selectedScan;
    if (!chromatogram.hasData()) {
      return; // can not set scan markers if chromatogram is not loaded
    }
    if (scans.length) {
      // if scan is already selected and is part of new scans then reselect scan
      if (
        scans.some(function(e) {
          return (e.id == selectedScan);
        })
      ) {
        chromatogram.setMarkers(scans);
        chromatogram.selectScan(selectedScan);
      } else {
        chromatogram.setMarkers(scans);
      }
    } else {
      this.application.fireEvent('noscansfound');
    }
  },
  center: function() {
    this.getChromatogram().resetScales();
  },
  showUploadForm: function() {
    var me = this;
    this.getUploadForm().setDisabledAnnotateFieldset(!this.hasMolecules);
    this.getUploadForm().loadDefaults(me.application.runInfoUrl());
    this.getChromatogramPanel().setActiveItem(1);
  },
  showChromatogram: function() {
    this.getChromatogramPanel().setActiveItem(0);
  },
  uploadHandler: function() {
    var me = this;
    var form = this.getUploadForm().getForm();
    if (form.isValid()) {
      form.submit({
        url: this.application.rpcUrl('add_ms_data'),
        waitMsg: 'Submitting action ...',
        submitEmptyText: false,
        success: function(fp, o) {
          var response = Ext.JSON.decode(o.response.responseText);
          me.application.fireEvent('rpcsubmitsuccess', response.jobid);
        },
        failure: function(form, action) {
          if (action.failureType === "server") {
            Ext.Error.raise(Ext.JSON.decode(action.response.responseText));
          } else {
            Ext.Error.raise(action.response.responseText);
          }
        }
      });
    }
  },
  /**
   * Show actions menu at event xy
   * @param {Ext.Element} tool
   * @param {Ext.EventObject} event
   */
  showActionsMenu: function(tool, event) {
    this.actionsMenu.showAt(event.getXY());
  },
  /**
   * Enable/Disable zoom on X axis
   * @param {Ext.Component} item
   * @param {Boolean} checked
   */
  onZoomDirectionXChange: function(item, checked) {
    this.onZoomDirectionChange('x', checked);
  },
  /**
   * Enable/Disable zoom on Y axis
   * @param {Ext.Component} item
   * @param {Boolean} checked
   */
  onZoomDirectionYChange: function(item, checked) {
    this.onZoomDirectionChange('y', checked);
  },
  /**
   * Enable/Disable zoom on a axis
   * @param {String} axes Name of axis. Can be 'x' or 'y'.
   * @param {Boolean} checked
   */
  onZoomDirectionChange: function(axis, checked) {
    this.getChromatogram().setZoom(axis, checked);
  },
  /**
   * Apply role to user interface.
   * Checks run feature and if false removes all action buttons.
   */
  applyRole: function() {
    if (!this.application.features.run && this.actionsMenu) {
      this.actionsMenu.hideUploadAction();
    }
    // TODO change tooltip of gears tool
  },
  /**
   * In MS Data upload forms loads the example data set.
   */
  loadExample: function(field) {
    this._loadExample('example');
  },
  loadExample2: function(field) {
    this._loadExample('example2');
  },
  loadExample3: function(field) {
    this._loadExample('example3');
  },
  _loadExample: function(example_name) {
    var form = this.getUploadForm().getForm();
    var example_url = this.application.runInfoUrl() + '?selection=' + example_name;
    form.load({
      url: example_url,
      method: 'GET',
      waitMsg: 'Fetching example settings',
      failure: function(form, action) {
        Ext.Error.raise(action.response.responseText);
      }
    });
  },
  /**
   * Called when MS data format is changed.
   * @param {Ext.form.field.Field} field
   * @param {String} value
   *
   * If value is mzxml then shows ms data filters and annotate precision and intensity thresholds.
   * If value is form_tree then hides ms data filters and annotate precision and intensity thresholds.
   * If vaule is mass_tree then hides ms data filters and annotate precursor precision and intensity thresholds.
   */
  changeMsDataFormat: function(field, value) {
    // form fields with name as key
    var fields = {};
    var form = field.up('form(true)').getForm();
    form.getFields().each(function(field) {
      fields[field.getName()] = field;
    });

    function show_form_fields(names) {
      Ext.Array.forEach(names, function(name) {
        var field = fields[name];
        field.enable();
        field.show();
      });
    }

    function hide_form_fields(names) {
      Ext.Array.forEach(names, function(name) {
        var field = fields[name];
        field.disable();
        field.hide();
      });
    }

    // show possibly hidden form fields
    show_form_fields([
      'filter_heading',
      'max_ms_level',
      'abs_peak_cutoff',
      'scan',
      'precision_heading',
      'mz_precision',
      'mz_precision_abs',
      'precursor_mz_precision',
      'intensity_heading',
      'ms_intensity_cutoff',
      'msms_intensity_cutoff'
    ]);
    if (value == 'form_tree') {
      // hide form fields not required for form_tree
      hide_form_fields([
        'filter_heading',
        'max_ms_level',
        'abs_peak_cutoff',
        'scan',
        'precision_heading',
        'mz_precision',
        'mz_precision_abs',
        'precursor_mz_precision',
        'intensity_heading',
        'ms_intensity_cutoff',
        'msms_intensity_cutoff'
      ]);
    } else if (value == 'mass_tree' || value == 'mgf') {
      // hide form fields not required for mass_tree
      hide_form_fields([
        'filter_heading',
        'max_ms_level',
        'scan',
        'abs_peak_cutoff',
        'precursor_mz_precision',
        'intensity_heading',
        'ms_intensity_cutoff',
        'msms_intensity_cutoff'
      ]);
    }
  },
  showHelp: function() {
    this.application.showHelp('chromatogram');
  }
});
