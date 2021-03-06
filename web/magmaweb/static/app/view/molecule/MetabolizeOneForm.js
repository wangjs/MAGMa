/**
 * Windowed form to metabolize one structure.
 *
 * @author <a href="mailto:s.verhoeven@esciencecenter.nl">Stefan Verhoeven</a>
 */
Ext.define('Esc.magmaweb.view.molecule.MetabolizeOneForm', {
  extend: 'Ext.window.Window',
  title: 'Metabolize structure',
  alias: 'widget.metabolizeoneform',
  requires: [
    'Ext.form.Panel',
    'Ext.form.field.Hidden',
    'Ext.form.field.Display',
    'Esc.magmaweb.view.molecule.MetabolizeFieldSet',
    'Esc.magmaweb.view.fragment.AnnotateFieldSet'
  ],
  modal: true,
  height: 300,
  width: 600,
  layout: 'fit',
  closeAction: 'hide',
  items: {
    xtype: 'form',
    bodyPadding: 5,
    defaults: {
      bodyPadding: 5
    },
    border: false,
    autoScroll: true,
    trackResetOnLoad: true,
    items: [{
      xtype: 'displayfield',
      fieldLabel: 'Name',
      name: 'name'
    }, {
      xtype: 'hiddenfield',
      name: 'molid'
    }, {
      margin: '0 0 10 0',
      xtype: 'metabolizefieldset'
    }, {
      xtype: 'annotatefieldset',
      collapsed: true,
      collapsible: true
    }],
    buttons: [{
      text: 'Metabolize structure',
      action: 'metabolize_one'
    }, {
      text: 'Reset',
      handler: function() {
        this.up('form').getForm().reset();
      }
    }]
  },
  /**
   * Set molecule to metabolize.
   *
   * @param {Esc.magmaweb.model.Molecule} rec Molecule to metabolize.
   */
  setMolecule: function(rec) {
    var form = this.down('form').getForm();
    form.setValues({
      'name': rec.get('name'),
      'molid': rec.get('molid')
    });
  },
  /**
   * Enable or disable annotate fieldset.
   *
   * @param {Boolean} disabled True to disable
   */
  setDisabledAnnotateFieldset: function(disabled) {
    this.query('annotatefieldset')[0].setDisabled(disabled);
  },
  /**
   * Get form.
   *
   * @return {Ext.form.Basic}
   */
  getForm: function() {
    return this.down('form').getForm();
  },
  /**
   * Load form defaults from server.
   * During loading this.loading will be true.
   *
   * @param {String} url Url to load defaults from.
   */
  loadDefaults: function(url) {
    var me = this;
    this.loading = true;
    this.getForm().load({
      url: url,
      method: 'GET',
      waitMsg: 'Fetching defaults',
      failure: function(form, action) {
        delete me.loading;
        Ext.Error.raise(action.response.responseText);
      },
      success: function(form) {
        delete me.loading;
      }
    });
  }
});
